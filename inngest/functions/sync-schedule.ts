import { cron } from "inngest";
import { shiftDate, todayOfficialDate } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule } from "@/lib/mlb";
import { findCompletedGamePks, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameCompleted } from "../events";

export const syncSchedule = inngest.createFunction(
  {
    id: "sync-schedule",
    triggers: [cron("TZ=UTC * 15-23,0-7 * 2-11 *")],
    singleton: { mode: "skip" },
  },
  async ({ step }) => {
    const { startDate, endDate, games, changed, completedGamePks } = await step.run(
      "load-schedule",
      async () => {
        const endDate = todayOfficialDate();
        const startDate = shiftDate(endDate, -1);
        const rows = parseSchedule(await fetchSchedule({ startDate, endDate }));
        const { changed } = await withConnection((conn) => upsertGames(conn, rows));
        return { startDate, endDate, games: rows.length, changed, completedGamePks: findCompletedGamePks(rows) };
      },
    );

    if (completedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-completed",
        completedGamePks.map((gamePk) => gameCompleted.create({ gamePk }, { id: `game-completed-${gamePk}` })),
      );
    }

    return { startDate, endDate, games, changed, completed: completedGamePks.length };
  },
);
