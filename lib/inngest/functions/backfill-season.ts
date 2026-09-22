import { db } from "@/lib/db";
import { fetchSchedule, fetchSeasonDates } from "@/lib/mlb";
import { parseSchedule, upsertGames, wasPlayed } from "@/lib/schedule";
import { inngest } from "../client";
import { gameFinal, seasonBackfillRequested } from "../events";

export const backfillSeason = inngest.createFunction(
  { id: "backfill-season", triggers: [seasonBackfillRequested] },
  async ({ event, step }) => {
    const { season, gameTypes } = event.data;

    const played = await step.run("upsert-games", async () => {
      const { startDate, endDate } = await fetchSeasonDates(season);
      const rows = parseSchedule(await fetchSchedule({ startDate, endDate, gameTypes }));
      await upsertGames(await db(), rows);
      return rows.filter((r) => wasPlayed(r.codedState)).map((r) => r.gamePk);
    });

    if (played.length > 0) {
      await step.sendEvent(
        "emit-game-final",
        played.map((gamePk) => gameFinal.create({ gamePk, season })),
      );
    }

    return { season, games: played.length };
  },
);
