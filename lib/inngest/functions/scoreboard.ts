import { cron } from "inngest";
import { easternDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { fetchSchedule } from "@/lib/mlb";
import { parseSchedule, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameFinal } from "../events";
import { scoreboardChannel, scoreUpdate } from "../realtime";

export const scoreboard = inngest.createFunction(
  { id: "scoreboard", triggers: [cron("TZ=UTC * 15-23,0-7 * 2-11 *")] },
  async ({ step }) => {
    const { scoreChanges, newlyFinal } = await step.run("upsert-games", async () => {
      const json = await fetchSchedule({ startDate: easternDate(-1), endDate: easternDate() });
      return upsertGames(await db(), parseSchedule(json));
    });

    if (scoreChanges.length > 0) {
      const updates = scoreChanges.map((row) => scoreUpdate.parse(row));
      await step.realtime.publish("publish", scoreboardChannel.games, updates);
    }

    if (newlyFinal.length > 0) {
      await step.sendEvent(
        "emit-game-final",
        newlyFinal.map(({ gamePk, season }) =>
          gameFinal.create({ gamePk, season }, { id: `final-${gamePk}` }),
        ),
      );
    }

    return { scoreChanges: scoreChanges.length, final: newlyFinal.map((g) => g.gamePk) };
  },
);
