import { withConnection } from "@/lib/db";
import { storeFeed } from "@/lib/feeds";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gameCompleted, gameFeedStored, gameUpdated } from "../events";

export const ingestGameFeed = inngest.createFunction(
  { id: "ingest-game-feed", triggers: [gameCompleted, gameUpdated], concurrency: 2 },
  async ({ event, step }) => {
    const { gamePk } = event.data;

    const { feedTs, status } = await step.run("load-game-feed", async () => {
      const feed = await fetchFeed(gamePk);
      return withConnection((conn) => storeFeed(conn, feed));
    });

    if (status === "stored") {
      await step.sendEvent(
        "emit-game-feed-stored",
        gameFeedStored.create({ gamePk }, { id: `game-feed-stored-${gamePk}-${feedTs}` }),
      );
    }

    return { gamePk, feedTs, status };
  },
);
