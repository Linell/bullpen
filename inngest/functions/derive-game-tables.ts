import { withConnection } from "@/lib/db";
import { deriveGame } from "@/lib/feeds";
import { inngest } from "../client";
import { gameFeedStored, gameTablesDerived } from "../events";

export const deriveGameTables = inngest.createFunction(
  {
    id: "derive-game-tables",
    triggers: [gameFeedStored],
    concurrency: [{ limit: 3 }, { key: "event.data.gamePk", limit: 1 }],
    debounce: { key: "event.data.gamePk", period: "30s", timeout: "2m" },
  },
  async ({ event, step }) => {
    const { gamePk, season } = event.data;

    const { plays, pitches } = await step.run("derive-game", () =>
      withConnection((conn) => deriveGame(conn, gamePk)),
    );

    await step.sendEvent(
      "emit-game-tables-derived",
      gameTablesDerived.create({ gamePk, season }, { id: `game-tables-derived-${gamePk}-${event.ts}` }),
    );

    return { gamePk, plays, pitches };
  },
);
