import { withConnection } from "@/lib/db";
import { storeFeed } from "@/lib/feeds";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gameCompleted, gameFeedStored, gameUpdated } from "../events";

const lane = "event.name == 'mlb/game.updated' || event.data.reason == 'live' ? 'live' : 'backfill'";

export const ingestGameFeed = inngest.createFunction(
  {
    id: "ingest-game-feed",
    triggers: [gameCompleted, gameUpdated],
    concurrency: [{ limit: 2 }, { key: lane, limit: 1 }],
  },
  async ({ event, step }) => {
    const { gamePk } = event.data;
    const reason = event.name === gameCompleted.name ? (event.data.reason ?? "backfill") : "live";

    const { feedTs, status } = await step.run("load-game-feed", async () => {
      const feed = await fetchFeed(gamePk);
      return withConnection((conn) => storeFeed(conn, feed));
    });

    if (status === "stored") {
      await step.sendEvent(
        "emit-game-feed-stored",
        gameFeedStored.create({ gamePk, reason }, { id: `game-feed-stored-${gamePk}-${feedTs}` }),
      );
    }

    return { gamePk, feedTs, status };
  },
);
