import { withConnection } from "@/lib/db";
import { deriveGame } from "@/lib/feeds";
import { inngest } from "../client";
import { gameFeedStored } from "../events";

export const deriveGameTables = inngest.createFunction(
  { id: "derive-game-tables", triggers: [gameFeedStored], concurrency: 1 },
  async ({ event, step }) => {
    const { gamePk } = event.data;

    const { plays, pitches } = await step.run("derive-game", () =>
      withConnection((conn) => deriveGame(conn, gamePk)),
    );

    return { gamePk, plays, pitches };
  },
);
