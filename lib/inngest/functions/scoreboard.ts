import { cron } from "inngest";
import { easternDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { fetchSchedule } from "@/lib/mlb";
import { parseSchedule, toScoreUpdate, upsertGames } from "@/lib/schedule";
import { inngest } from "../client";
import { gameFinal } from "../events";
import { scoreboard as channel } from "../realtime";

// Every minute, February–November, about 11am–4am ET.
export const scoreboard = inngest.createFunction(
  { id: "scoreboard", triggers: [cron("TZ=UTC * 15-23,0-7 * 2-11 *")] },
  async ({ step }) => {
    const { changed, newlyFinal } = await step.run("upsert-games", async () => {
      // Yesterday too, to catch late-running and resumed games.
      const json = await fetchSchedule({ startDate: easternDate(-1), endDate: easternDate() });
      return upsertGames(await db(), parseSchedule(json));
    });

    if (changed.length > 0) {
      await step.realtime.publish("publish", channel.games, changed.map(toScoreUpdate));
    }

    if (newlyFinal.length > 0) {
      await step.sendEvent(
        "emit-game-final",
        // Event ids let Inngest drop duplicates if a game is seen as final twice.
        newlyFinal.map(({ gamePk, season }) =>
          gameFinal.create({ gamePk, season }, { id: `final-${gamePk}` }),
        ),
      );
    }

    return { changed: changed.length, final: newlyFinal.map((g) => g.gamePk) };
  },
);
