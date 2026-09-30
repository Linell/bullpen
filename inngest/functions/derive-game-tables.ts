import { revalidateTag } from "next/cache";
import { withConnection } from "@/lib/db";
import { deriveGame } from "@/lib/feeds";
import { gameCacheTags, playerCacheTags } from "@/lib/game-cache-tags";
import { refreshGameDayRollups } from "@/lib/season-rollups";
import { gameChannel, scoreboardChannel } from "../channels";
import { inngest } from "../client";
import { gameFeedStored, seasonRollupsRebuildRequested } from "../events";

export const deriveGameTables = inngest.createFunction(
  {
    id: "derive-game-tables",
    triggers: [gameFeedStored],
    // Debounce can start a run while a slow one continues.
    concurrency: [{ limit: 3 }, { key: "event.data.gamePk", limit: 1 }],
    debounce: { key: "event.data.gamePk", period: "30s", timeout: "2m" },
  },
  async ({ event, step }) => {
    const { gamePk } = event.data;

    const { plays, pitches, seasons } = await step.run("derive-game", () =>
      withConnection((conn) => deriveGame(conn, gamePk)),
    );

    await step.run("refresh-game-day-rollups", () =>
      withConnection((conn) => refreshGameDayRollups(conn, gamePk)),
    );

    const tags = await step.run("load-game-tags", async () => [
      ...(await gameCacheTags([gamePk])),
      ...(await playerCacheTags([gamePk])),
    ]);

    await step.run("expire-game-tags", () => {
      // Clients refresh on the stats publish, so never serve stale.
      for (const tag of tags) revalidateTag(tag, { expire: 0 });
    });

    await step.realtime.publish("publish-scoreboard-stats", scoreboardChannel.stats, { gamePk });
    await step.realtime.publish("publish-game-stats", gameChannel({ gamePk }).stats, { gamePk });

    if (seasons.length > 0) {
      await step.sendEvent(
        "emit-season-rollups-rebuild-requested",
        seasons.map((season) => seasonRollupsRebuildRequested.create({ season })),
      );
    }

    return { gamePk, plays, pitches, tags: tags.length };
  },
);
