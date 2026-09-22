import { connect } from "@/lib/db";
import { ingestFeed } from "@/lib/feeds";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gameFinal } from "../events";

const singleWriter = !process.env.DUCKDB_URL?.startsWith("md:");

export const ingestGame = inngest.createFunction(
  {
    id: "ingest-game",
    triggers: [gameFinal],
    concurrency: { limit: singleWriter ? 1 : 2 },
  },
  async ({ event, step }) => {
    return step.run("fetch-and-ingest", async () => {
      const feed = await fetchFeed(event.data.gamePk);
      const conn = await connect();
      try {
        return await ingestFeed(conn, feed);
      } finally {
        conn.closeSync();
      }
    });
  },
);
