import { withConnection } from "@/lib/db";
import { deriveGames, storeFeeds } from "@/lib/feeds";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gamesBackfillRequested } from "../events";

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

    const { plays, pitches } =
      stored.length > 0
        ? await step.run("derive-games", () => withConnection((conn) => deriveGames(conn, stored)))
        : { plays: 0, pitches: 0 };

    return { games: gamePks.length, stored: stored.length, failed, plays, pitches };
  },
);

async function fetchAndStoreFeeds(gamePks: number[]) {
  const results = await Promise.allSettled(gamePks.map(fetchFeed));
  const feeds = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failed = gamePks.filter((_, i) => results[i].status === "rejected");
  const stored = await withConnection((conn) => storeFeeds(conn, feeds));
  return { stored, failed };
}
