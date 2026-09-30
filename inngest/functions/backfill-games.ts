import { withConnection } from "@/lib/db";
import { deriveGames, storeFeeds } from "@/lib/feeds";
import { NonRetriableError, RetryAfterError } from "inngest";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gamesBackfillRequested, seasonTablesRebuildRequested } from "../events";

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

    const { failed } = refetch ? await step.run("store-feeds", () => fetchAndStoreFeeds(gamePks)) : { failed: [] };

    // Derives every game, so a retry after the store committed still derives its feeds.
    const { plays, pitches, seasons } = await step.run("derive-games", () =>
      withConnection((conn) => deriveGames(conn, gamePks)),
    );

    if (seasons.length > 0) {
      await step.sendEvent(
        "emit-season-tables-rebuild-requested",
        seasons.map((season) => seasonTablesRebuildRequested.create({ season })),
      );
    }

    return { games: gamePks.length, failed, plays, pitches };
  },
);

async function fetchAndStoreFeeds(gamePks: number[]) {
  const results = await Promise.allSettled(gamePks.map(fetchFeed));
  const feeds = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  await withConnection((conn) => storeFeeds(conn, feeds));

  // Transient errors (429, 5xx) retry the step; stored feeds come back unchanged.
  const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  const transient =
    errors.find((error) => error instanceof RetryAfterError) ??
    errors.find((error) => !(error instanceof NonRetriableError));
  if (transient) throw transient;

  const failed = gamePks.filter((_, i) => results[i].status === "rejected");
  return { failed };
}
