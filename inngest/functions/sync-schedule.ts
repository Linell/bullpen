import { cron } from "inngest";
import { shiftDate, todayOfficialDate } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule } from "@/lib/mlb";
import { recordProbables } from "@/lib/probables";
import { findCompletedGamePks, findLiveGamePks, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameCompleted, gameProbablesChanged, gameUpdated } from "../events";

export const syncSchedule = inngest.createFunction(
  {
    id: "sync-schedule",
    triggers: [cron("TZ=UTC * 15-23,0-7 * 2-11 *")],
    singleton: { mode: "skip" },
  },
  async ({ event, step }) => {
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
    const updatedGamePks = findLiveGamePks(rows).filter((gamePk) => changedGamePks.includes(gamePk));

    if (completedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-completed",
        completedGamePks.map((gamePk) => gameCompleted.create({ gamePk, reason: "live" }, { id: `game-completed-${gamePk}` })),
      );
    }

    if (updatedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-updated",
        updatedGamePks.map((gamePk) =>
          gameUpdated.create({ gamePk }, { id: `game-updated-${gamePk}-${event.ts}` }),
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
      startDate,
      endDate,
      games: rows.length,
      changed,
      completed: completedGamePks.length,
      updated: updatedGamePks.length,
      probablesChanged: probablesGamePks.length,
    };
  },
);
