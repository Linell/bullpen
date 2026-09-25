import { withConnection } from "@/lib/db";
import { rawFeedGamePks } from "@/lib/feeds";
import { inngest } from "../client";
import { gameFeedStored, gameTablesRebuildRequested } from "../events";

const EVENTS_PER_SEND = 5000;

export const rebuildGameTables = inngest.createFunction(
  { id: "rebuild-game-tables", triggers: [gameTablesRebuildRequested] },
  async ({ event, step }) => {
    const gamePks = await step.run("list-raw-feeds", () => withConnection(rawFeedGamePks));

    for (let start = 0; start < gamePks.length; start += EVENTS_PER_SEND) {
      const batchNumber = start / EVENTS_PER_SEND + 1;
      const batch = gamePks.slice(start, start + EVENTS_PER_SEND);
      await step.sendEvent(
        `emit-game-feed-stored-${batchNumber}`,
        batch.map((gamePk) =>
          gameFeedStored.create({ gamePk, reason: "backfill" }, { id: `game-feed-stored-${gamePk}-${event.ts}` }),
        ),
      );
    }

    return { feeds: gamePks.length };
  },
);
