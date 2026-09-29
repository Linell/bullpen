import { NonRetriableError } from "inngest";
import { revalidateTag } from "next/cache";
import { BACKFILL_TAGS } from "@/lib/cache-tags";
import { clampDateRange } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule, fetchScheduleGames, fetchSeasonDates } from "@/lib/mlb";
import { recordProbables } from "@/lib/probables";
import { findCompletedGamePks, findRescheduledGamePks, parseSchedule, replaceGames, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameProbablesChanged, seasonBackfillRequested } from "../events";
import { backfillBatches, backfillGames } from "./backfill-games";

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

    if (probablesGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-probables-changed",
        probablesGamePks.map((gamePk) =>
          gameProbablesChanged.create({ gamePk }, { id: `game-probables-changed-${gamePk}-${event.ts}` }),
        ),
      );
    }

    const completedGamePks = findCompletedGamePks(rows);

    const backfills = await Promise.all(
      backfillBatches(completedGamePks).map((batch, i) =>
        step.invoke(`backfill-games-${i + 1}`, { function: backfillGames, data: { gamePks: batch, refetch: true } }),
      ),
    );

    await step.run("revalidate-tags", () => {
      for (const tag of BACKFILL_TAGS) revalidateTag(tag, { expire: 0 });
    });

    return {
      season,
      ...dates,
      games: rows.length,
      rescheduled: rescheduled.length,
      changed,
      completed: completedGamePks.length,
      failed: backfills.flatMap((backfill) => backfill.failed),
      probablesChanged: probablesGamePks.length,
    };
  },
);
