import { withConnection } from "@/lib/db";
import { fetchSchedule, fetchSeasonDates } from "@/lib/mlb";
import { findCompletedGamePks, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameCompleted, seasonBackfillRequested } from "../events";

export const backfillSeason = inngest.createFunction(
  { id: "backfill-season", triggers: [seasonBackfillRequested] },
  async ({ event, step }) => {
    const { season } = event.data;

    const dates = await step.run("fetch-season-dates", () => fetchSeasonDates(season));

    const rows = await step.run("fetch-schedule", async () => parseSchedule(await fetchSchedule(dates)));

    const { changed } = await step.run("upsert-games", () =>
      withConnection((conn) => upsertGames(conn, rows)),
    );

    const completedGamePks = findCompletedGamePks(rows);

    if (completedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-completed",
        completedGamePks.map((gamePk) =>
          gameCompleted.create({ gamePk }, { id: `game-completed-${gamePk}-${event.ts}` }),
        ),
      );
    }

    return { season, games: rows.length, changed, completed: completedGamePks.length };
  },
);
