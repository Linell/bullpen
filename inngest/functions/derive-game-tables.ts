import { withConnection } from "@/lib/db";
import { deriveGame } from "@/lib/feeds";
import { inngest } from "../client";
import { gameFeedStored, gameTablesDerived } from "../events";

export const deriveGameTables = inngest.createFunction(
  {
    id: "derive-game-tables",
    triggers: [gameFeedStored],
    concurrency: [{ limit: 3 }, { key: "event.data.reason", limit: 2 }],
    priority: { run: "event.data.reason == 'backfill' ? 0 : 600" },
    debounce: { key: "event.data.gamePk", period: "30s", timeout: "2m" },
  },
  async ({ event, step }) => {
    const { gamePk } = event.data;

    const { plays, pitches } = await step.run("derive-game", () =>
      withConnection((conn) => deriveGame(conn, gamePk)),
    );

    await step.sendEvent(
      "emit-game-tables-derived",
      gameTablesDerived.create({ gamePk }, { id: `game-tables-derived-${gamePk}-${event.ts}` }),
    );

    return { gamePk, plays, pitches };
  },
);
