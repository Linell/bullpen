import { withConnection } from "@/lib/db";
import { readFeed, storeFeed } from "@/lib/feeds";
import { diffFeeds } from "@/lib/live-game";
import { fetchFeed } from "@/lib/mlb";
import { gameChannel, scoreboardChannel } from "../channels";
import { inngest } from "../client";
import { gameCompleted, gameFeedStored, gameFeedUpdated } from "../events";

export const ingestGameFeed = inngest.createFunction(
  {
    id: "ingest-game-feed",
    triggers: [gameCompleted, gameFeedUpdated],
    concurrency: [{ limit: 6 }, { key: "event.data.gamePk", limit: 1 }],
  },
  async ({ event, step }) => {
    const { gamePk } = event.data;

    const { feedTs, status, diff } = await step.run("load-game-feed", async () => {
      const feed = await fetchFeed(gamePk);
      return withConnection(async (conn) => {
        const previous = await readFeed(conn, gamePk);
        const stored = await storeFeed(conn, feed);
        const diff = stored.status === "stored" ? diffFeeds(previous, feed) : null;
        return { ...stored, diff };
      });
    });

    if (status === "stored") {
      await step.sendEvent(
        "emit-game-feed-stored",
        gameFeedStored.create({ gamePk }, { id: `game-feed-stored-${gamePk}-${feedTs}` }),
      );
    }

    if (diff?.game) {
      await step.realtime.publish("publish-scoreboard-game", scoreboardChannel.game, diff.game);
      await step.realtime.publish("publish-game-page-game", gameChannel({ gamePk }).game, diff.game);
    }

    if (diff && diff.plays.length > 0) {
      await step.realtime.publish("publish-plays", scoreboardChannel.play, { gamePk, plays: diff.plays });
      await step.realtime.publish("publish-game-page-plays", gameChannel({ gamePk }).play, { gamePk, plays: diff.plays });
    }

    return { gamePk, feedTs, status };
  },
);
