import { revalidateTag } from "next/cache";
import { gameCacheTags, playerCacheTags } from "@/lib/game-cache-tags";
import { gameChannel, scoreboardChannel } from "../channels";
import { inngest } from "../client";
import { gameCompleted, gameProbablesChanged, gameScheduleChanged, gameTablesDerived } from "../events";

export const invalidateGameCache = inngest.createFunction(
  {
    id: "invalidate-game-cache",
    triggers: [gameScheduleChanged, gameCompleted, gameProbablesChanged, gameTablesDerived],
    batchEvents: { maxSize: 5, timeout: "5s" },
  },
  async ({ events, step }) => {
    const gamePks = [...new Set(events.map((event) => event.data.gamePk))];
    const derivedEvents = events.filter((event) => event.name === gameTablesDerived.name);
    const derivedGamePks = [...new Set(derivedEvents.map((event) => event.data.gamePk))];
    const otherGamePks = gamePks.filter((gamePk) => !derivedGamePks.includes(gamePk));

    const gameTags = await step.run("load-game-tags", () => gameCacheTags(otherGamePks));

    const refreshedTags = await step.run("load-refreshed-tags", async () => [
      ...(await gameCacheTags(derivedGamePks)),
      ...(await playerCacheTags(derivedGamePks)),
    ]);

    const staleTags = gameTags.filter((tag) => !refreshedTags.includes(tag));

    await step.run("revalidate-tags", () => {
      for (const tag of staleTags) revalidateTag(tag, "max");
      // Clients refresh on the stats publish, so never serve stale.
      for (const tag of refreshedTags) revalidateTag(tag, { expire: 0 });
    });

    if (derivedGamePks.length > 0) {
      await step.realtime.publish("publish-scoreboard-stats", scoreboardChannel.stats, { gamePks: derivedGamePks });
    }

    for (const gamePk of derivedGamePks) {
      await step.realtime.publish(`publish-game-stats-${gamePk}`, gameChannel({ gamePk }).stats, { gamePk });
    }

    return { gamePks: gamePks.length, tags: staleTags.length + refreshedTags.length };
  },
);
