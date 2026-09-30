import { shiftDate, todayOfficialDate } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule } from "@/lib/mlb";
import { recordProbables } from "@/lib/probables";
import { findCompletedGamePks, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { everyMinuteOfBaseballHours } from "../cron";
import { gameScheduleChanged, gameCompleted, gameProbablesChanged } from "../events";

export const syncSchedule = inngest.createFunction(
  {
    id: "sync-schedule",
    triggers: [everyMinuteOfBaseballHours],
    singleton: { mode: "skip" },
  },
  async ({ step }) => {
    const { startDate, endDate, rows } = await step.run("fetch-schedule", async () => {
      const today = todayOfficialDate();
      const startDate = shiftDate(today, -1);
      const endDate = shiftDate(today, 6);
      const rows = parseSchedule(await fetchSchedule({ startDate, endDate }));
      return { startDate, endDate, rows };
    });

    const { changed, changedGamePks } = await step.run("upsert-games", () =>
      withConnection((conn) => upsertGames(conn, rows)),
    );

    const probablesGamePks = await step.run("record-probables", () =>
      withConnection((conn) => recordProbables(conn, changedGamePks)),
    );

    const completedGamePks = findCompletedGamePks(rows);

    if (completedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-completed",
        completedGamePks.map((gamePk) => gameCompleted.create({ gamePk }, { id: `game-completed-${gamePk}` })),
      );
    }

    if (changedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-schedule-changed",
        changedGamePks.map((gamePk) => gameScheduleChanged.create({ gamePk })),
      );
    }

    if (probablesGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-probables-changed",
        probablesGamePks.map((gamePk) => gameProbablesChanged.create({ gamePk })),
      );
    }

    return {
      startDate,
      endDate,
      games: rows.length,
      changed,
      completed: completedGamePks.length,
      probablesChanged: probablesGamePks.length,
    };
  },
);
