import { connect } from "@/lib/db";
import { deriveGame, upsertRawFeed } from "@/lib/feeds";
import { fetchFeed } from "@/lib/mlb";
import { inngest } from "../client";
import { gameFinal } from "../events";

// An offline .duckdb file allows a single writer.
const isLocalFile = !process.env.DUCKDB_URL?.startsWith("md:");

export const ingestGame = inngest.createFunction(
  {
    id: "ingest-game",
    triggers: [gameFinal],
    concurrency: { limit: isLocalFile ? 1 : 2 },
  },
  async ({ event, step }) => {
    // One step so the ~700 KB feed never lands in Inngest state.
    return step.run("ingest", async () => {
      const feed = await fetchFeed(event.data.gamePk);
      const conn = await connect();
      try {
        const raw = await upsertRawFeed(conn, feed);
        if (raw.status === "unchanged") return raw;
        return { ...raw, ...(await deriveGame(conn, raw.gamePk)) };
      } finally {
        conn.closeSync();
      }
    });
  },
);
