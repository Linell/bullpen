import { setTimeout as sleep } from "node:timers/promises";
import { withConnection } from "@/lib/db";
import { fetchFeedTimestamp } from "@/lib/mlb";
import { readLiveGamePks } from "@/lib/schedule";
import { inngest } from "../client";
import { everyMinuteOfBaseballHours } from "../cron";
import { gameFeedUpdated } from "../events";

const WATCH_MS = 50_000;
const POLL_MS = 5_000;

export const watchLiveGames = inngest.createFunction(
  {
    id: "watch-live-games",
    triggers: [everyMinuteOfBaseballHours],
    singleton: { mode: "skip" },
  },
  // One looping step gives 5s updates; normally a separate poller.
  async ({ step }) =>
    step.run("watch-feeds", async () => {
      const gamePks = await withConnection(readLiveGamePks);
      if (gamePks.length === 0) return { games: 0, updates: 0 };
      return { games: gamePks.length, updates: await watchFeeds(gamePks) };
    }),
);

async function watchFeeds(gamePks: number[]) {
  const lastSeen = new Map<number, string>();
  const stopAt = Date.now() + WATCH_MS;
  let updates = 0;

  while (true) {
    const results = await Promise.allSettled(gamePks.map(fetchFeedTimestamp));
    const changed = gamePks.flatMap((gamePk, i) => {
      const result = results[i];
      if (result.status === "rejected" || lastSeen.get(gamePk) === result.value) return [];
      return [{ gamePk, timeStamp: result.value }];
    });

    if (changed.length > 0) {
      // Timestamp ids dedupe re-sends of the same feed.
      await inngest.send(
        changed.map(({ gamePk, timeStamp }) =>
          gameFeedUpdated.create({ gamePk }, { id: `game-feed-updated-${gamePk}-${timeStamp}` }),
        ),
      );
    }

    for (const { gamePk, timeStamp } of changed) lastSeen.set(gamePk, timeStamp);
    updates += changed.length;
    if (Date.now() + POLL_MS >= stopAt) break;
    await sleep(POLL_MS);
  }

  return updates;
}
