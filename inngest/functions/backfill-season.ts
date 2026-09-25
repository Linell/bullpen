import { NonRetriableError } from "inngest";
import { clampDateRange } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule, fetchScheduleGames, fetchSeasonDates } from "@/lib/mlb";
import { recordProbables } from "@/lib/probables";
import { findCompletedGamePks, findRescheduledGamePks, parseSchedule, replaceGames, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameCompleted, gameProbablesChanged, seasonBackfillRequested } from "../events";

export const backfillSeason = inngest.createFunction(
  { id: "backfill-season", triggers: [seasonBackfillRequested] },
  async ({ event, step }) => {
    const { season } = event.data;

    const seasonDates = await step.run("fetch-season-dates", () => fetchSeasonDates(season));
    const dates = clampDateRange(event.data, seasonDates);
    if (dates.startDate > dates.endDate) {
      throw new NonRetriableError(`No ${season} season dates between ${event.data.startDate} and ${event.data.endDate}`);
    }

    const scheduled = await step.run("fetch-schedule", async () => parseSchedule(await fetchSchedule(dates)));

    const rescheduledGamePks = findRescheduledGamePks(scheduled);
    const rescheduled =
      rescheduledGamePks.length > 0
        ? await step.run("fetch-rescheduled-games", async () =>
            parseSchedule(await fetchScheduleGames(rescheduledGamePks)),
          )
        : [];
    const rows = replaceGames(scheduled, rescheduled);

    const { changed } = await step.run("upsert-games", () =>
      withConnection((conn) => upsertGames(conn, rows)),
    );

    const gamePks = rows.map((row) => row.gamePk);
    const probablesGamePks = await step.run("record-probables", () =>
      withConnection((conn) => recordProbables(conn, gamePks)),
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

    if (probablesGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-probables-changed",
        probablesGamePks.map((gamePk) =>
          gameProbablesChanged.create({ gamePk }, { id: `game-probables-changed-${gamePk}-${event.ts}` }),
        ),
      );
    }

    return {
      season,
      ...dates,
      games: rows.length,
      rescheduled: rescheduled.length,
      changed,
      completed: completedGamePks.length,
      probablesChanged: probablesGamePks.length,
    };
  },
);
