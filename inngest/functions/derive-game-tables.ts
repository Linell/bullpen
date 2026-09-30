import { withConnection } from "@/lib/db";
import { deriveGame } from "@/lib/feeds";
import { refreshGameDayRollups } from "@/lib/season-rollups";
import { inngest } from "../client";
import { gameFeedStored, gameTablesDerived, seasonRollupsRebuildRequested } from "../events";

export const deriveGameTables = inngest.createFunction(
  {
    id: "derive-game-tables",
    triggers: [gameFeedStored],
    concurrency: [{ limit: 3 }, { key: "event.data.gamePk", limit: 1 }],
    debounce: { key: "event.data.gamePk", period: "30s", timeout: "2m" },
  },
  async ({ event, step }) => {
    const { gamePk } = event.data;

    const { plays, pitches, seasons } = await step.run("derive-game", () =>
      withConnection((conn) => deriveGame(conn, gamePk)),
    );

    await step.run("refresh-game-day-rollups", () =>
      withConnection((conn) => refreshGameDayRollups(conn, gamePk)),
    );

    await step.sendEvent("emit-game-tables-derived", [
      gameTablesDerived.create({ gamePk }),
      ...seasons.map((season) => seasonRollupsRebuildRequested.create({ season })),
    ]);

    return { gamePk, plays, pitches };
  },
);
