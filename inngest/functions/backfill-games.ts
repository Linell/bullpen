import type { DuckDBConnection } from "@duckdb/node-api";
import { withConnection } from "@/lib/db";
import { deriveGames, rawFeedSeasons, storeFeeds } from "@/lib/feeds";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gamesBackfillRequested, seasonRollupsRebuildRequested } from "../events";

const GAMES_PER_BACKFILL = 25;

export function backfillBatches(gamePks: number[]) {
  const batches: number[][] = [];
  for (let start = 0; start < gamePks.length; start += GAMES_PER_BACKFILL) {
    batches.push(gamePks.slice(start, start + GAMES_PER_BACKFILL));
  }
  return batches;
}

export const backfillGames = inngest.createFunction(
  { id: "backfill-games", triggers: [gamesBackfillRequested], concurrency: { limit: 2 } },
  async ({ event, step }) => {
    const { gamePks, refetch } = event.data;

    const { stored, failed } = refetch
      ? await step.run("store-feeds", () => fetchAndStoreFeeds(gamePks))
      : { stored: gamePks, failed: [] };

    const { plays, pitches, seasons } =
      stored.length > 0
        ? await step.run("derive-games", () => withConnection((conn) => deriveAndListSeasons(conn, stored)))
        : { plays: 0, pitches: 0, seasons: [] };

    if (seasons.length > 0) {
      await step.sendEvent(
        "emit-season-rollups-rebuild-requested",
        seasons.map((season) => seasonRollupsRebuildRequested.create({ season })),
      );
    }

    return { games: gamePks.length, stored: stored.length, failed, plays, pitches };
  },
);

async function deriveAndListSeasons(conn: DuckDBConnection, gamePks: number[]) {
  const counts = await deriveGames(conn, gamePks);
  return { ...counts, seasons: await rawFeedSeasons(conn, gamePks) };
}

async function fetchAndStoreFeeds(gamePks: number[]) {
  const results = await Promise.allSettled(gamePks.map(fetchFeed));
  const feeds = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failed = gamePks.filter((_, i) => results[i].status === "rejected");
  const stored = await withConnection((conn) => storeFeeds(conn, feeds));
  return { stored, failed };
}
