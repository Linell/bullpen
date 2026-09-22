import { db } from "@/lib/db";
import { fetchSchedule, fetchSeasonDates } from "@/lib/mlb";
import { wasPlayed, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { DEFAULT_GAME_TYPES, gameFinal, seasonBackfillRequested } from "../events";

export const backfillSeason = inngest.createFunction(
  { id: "backfill-season", triggers: [seasonBackfillRequested] },
  async ({ event, step }) => {
    const { season, gameTypes = DEFAULT_GAME_TYPES } = event.data;

    const played = await step.run("upsert-games", async () => {
      const { startDate, endDate } = await fetchSeasonDates(season);
      const rows = parseSchedule(await fetchSchedule({ startDate, endDate, gameTypes }));
      await upsertGames(await db(), rows);
      return rows.filter((r) => wasPlayed(r.codedState)).map((r) => r.gamePk);
    });

    // No event ids: re-running a backfill must re-ingest (unchanged feeds are skipped).
    if (played.length > 0) {
      await step.sendEvent(
        "emit-game-final",
        played.map((gamePk) => gameFinal.create({ gamePk, season })),
      );
    }

    return { season, gameTypes, games: played.length };
  },
);
