import { withConnection } from "@/lib/db";
import { fetchSchedule, fetchSeasonDates } from "@/lib/mlb";
import { findCompletedGamePks, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameCompleted, seasonBackfillRequested } from "../events";

export const backfillSeason = inngest.createFunction(
  { id: "backfill-season", triggers: [seasonBackfillRequested] },
  async ({ event, step }) => {
    const { season } = event.data;

    const { games, changed, completedGamePks } = await step.run("load-schedule", async () => {
      const rows = parseSchedule(await fetchSchedule(await fetchSeasonDates(season)));
      const { changed } = await withConnection((conn) => upsertGames(conn, rows));
      return { games: rows.length, changed, completedGamePks: findCompletedGamePks(rows) };
    });

    if (completedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-completed",
        completedGamePks.map((gamePk) =>
          gameCompleted.create({ gamePk }, { id: `game-completed-${gamePk}-${event.ts}` }),
        ),
      );
    }

    return { season, games, changed, completed: completedGamePks.length };
  },
);
