import { NonRetriableError } from "inngest";
import { revalidateTag } from "next/cache";
import { ALL_DATA_TAGS } from "@/lib/cache-tags";
import { clampDateRange } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule, fetchScheduleGames, fetchSeasonDates } from "@/lib/mlb";
import { recordProbables } from "@/lib/probables";
import { findCompletedGamePks, findRescheduledGamePks, parseSchedule, replaceGames, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { seasonBackfillRequested } from "../events";
import { backfillBatches, backfillGames } from "./backfill-games";

export const backfillSeason = inngest.createFunction(
  {
    id: "backfill-season",
    triggers: [seasonBackfillRequested],
    singleton: { key: "event.data.season", mode: "skip" },
  },
  async ({ event, step }) => {
    const { season } = event.data;

    const seasonDates = await step.run("fetch-season-dates", () => fetchSeasonDates(season));
    const dates = clampDateRange(event.data, seasonDates);
    if (dates.startDate > dates.endDate) {
      throw new NonRetriableError(`No ${season} season dates between ${event.data.startDate} and ${event.data.endDate}`);
    }

    const synced = await step.run("sync-games", async () => {
      const scheduled = parseSchedule(await fetchSchedule(dates));
      const rescheduledGamePks = findRescheduledGamePks(scheduled);
      const rescheduled =
        rescheduledGamePks.length > 0 ? parseSchedule(await fetchScheduleGames(rescheduledGamePks)) : [];
      const rows = replaceGames(scheduled, rescheduled);
      const { changed } = await withConnection((conn) => upsertGames(conn, rows));
      return {
        rescheduled: rescheduled.length,
        changed,
        gamePks: rows.map((row) => row.gamePk),
        completedGamePks: findCompletedGamePks(rows),
      };
    });

    const probablesChanged = await step.run("record-probables", async () => {
      const changedGamePks = await withConnection((conn) => recordProbables(conn, synced.gamePks));
      return changedGamePks.length;
    });

    const backfills = await Promise.all(
      backfillBatches(synced.completedGamePks).map((batch, i) =>
        step.invoke(`backfill-games-${i + 1}`, { function: backfillGames, data: { gamePks: batch, refetch: true } }),
      ),
    );

    await step.run("revalidate-tags", () => {
      for (const tag of ALL_DATA_TAGS) revalidateTag(tag, "max");
    });

    return {
      season,
      ...dates,
      games: synced.gamePks.length,
      rescheduled: synced.rescheduled,
      changed: synced.changed,
      completed: synced.completedGamePks.length,
      failed: backfills.flatMap((backfill) => backfill.failed),
      probablesChanged,
    };
  },
);
