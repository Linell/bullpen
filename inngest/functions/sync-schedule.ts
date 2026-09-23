import { cron } from "inngest";
import { shiftDate, todayOfficialDate } from "@/lib/dates";
import { withConnection } from "@/lib/db";
import { fetchSchedule } from "@/lib/mlb";
import { findCompletedGamePks, findLiveGamePks, parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameCompleted, gameUpdated } from "../events";

export const syncSchedule = inngest.createFunction(
  {
    id: "sync-schedule",
    triggers: [cron("TZ=UTC * 15-23,0-7 * 2-11 *")],
    singleton: { mode: "skip" },
  },
  async ({ event, step }) => {
    const { startDate, endDate, rows } = await step.run("fetch-schedule", async () => {
      const endDate = todayOfficialDate();
      const startDate = shiftDate(endDate, -1);
      const rows = parseSchedule(await fetchSchedule({ startDate, endDate }));
      return { startDate, endDate, rows };
    });

    const { changed, changedGamePks } = await step.run("upsert-games", () =>
      withConnection((conn) => upsertGames(conn, rows)),
    );

    const completedGamePks = findCompletedGamePks(rows);
    const updatedGamePks = findLiveGamePks(rows).filter((gamePk) => changedGamePks.includes(gamePk));

    if (completedGamePks.length > 0) {
      await step.sendEvent(
        "emit-game-completed",
        completedGamePks.map((gamePk) => gameCompleted.create({ gamePk }, { id: `game-completed-${gamePk}` })),
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

    return {
      startDate,
      endDate,
      games: rows.length,
      changed,
      completed: completedGamePks.length,
      updated: updatedGamePks.length,
    };
  },
);
