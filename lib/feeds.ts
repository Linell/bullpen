import "server-only";
import { type DuckDBConnection, listValue } from "@duckdb/node-api";
import { readSql } from "@/lib/db";
import { inTransaction, runStatements } from "@/lib/statements";

type FeedHeader = {
  gamePk?: unknown;
  metaData?: { timeStamp?: unknown };
  gameData?: { game?: { season?: unknown }; status?: { abstractGameState?: unknown } };
};

type FeedRow = ReturnType<typeof readFeedHeader>;
type FeedTable = "raw_game_feeds" | "live_game_feeds";

export async function storeFeed(conn: DuckDBConnection, feed: unknown) {
  const { gamePk, feedTs } = readFeedHeader(feed);
  const stored = await storeFeeds(conn, [feed]);
  const status = stored.length > 0 ? ("stored" as const) : ("unchanged" as const);
  return { status, gamePk, feedTs };
}

export async function storeFeeds(conn: DuckDBConnection, feeds: unknown[]): Promise<number[]> {
  if (feeds.length === 0) return [];
  const rows = feeds.map((feed) => ({ ...readFeedHeader(feed), json: JSON.stringify(feed) }));
  return inTransaction(conn, async () => {
    const final = await upsertFeeds(conn, "raw_game_feeds", "live_game_feeds", rows.filter((row) => row.isFinal));
    if (final.length > 0) {
      await conn.run("DELETE FROM live_game_feeds WHERE game_pk IN (SELECT unnest($gamePks::INTEGER[]))", {
        gamePks: listValue(final),
      });
    }
    const live = await upsertFeeds(conn, "live_game_feeds", "raw_game_feeds", rows.filter((row) => !row.isFinal));
    return [...final, ...live];
  });
}

// Stores feeds newer than both tables' copies; returns the stored game pks.
async function upsertFeeds(
  conn: DuckDBConnection,
  table: FeedTable,
  other: FeedTable,
  rows: (FeedRow & { json: string })[],
): Promise<number[]> {
  if (rows.length === 0) return [];
  const stored = await conn.runAndReadAll(
    `INSERT INTO ${table} (game_pk, season, feed_ts, fetched_at, json)
     SELECT game_pk, season, feed_ts, now(), json
     FROM (
       SELECT unnest($gamePks::INTEGER[]) AS game_pk, unnest($seasons::INTEGER[]) AS season,
         unnest($feedTs::VARCHAR[]) AS feed_ts, unnest($jsons::VARCHAR[]) AS json
     ) AS incoming
     WHERE NOT EXISTS (
       SELECT 1 FROM ${other} AS stored WHERE stored.game_pk = incoming.game_pk AND stored.feed_ts >= incoming.feed_ts
     )
     ON CONFLICT (game_pk) DO UPDATE SET
       season = excluded.season,
       feed_ts = excluded.feed_ts,
       fetched_at = excluded.fetched_at,
       json = excluded.json
     WHERE excluded.feed_ts > ${table}.feed_ts
     RETURNING game_pk`,
    {
      gamePks: listValue(rows.map((row) => row.gamePk)),
      seasons: listValue(rows.map((row) => row.season)),
      feedTs: listValue(rows.map((row) => row.feedTs)),
      jsons: listValue(rows.map((row) => row.json)),
    },
  );
  return stored.getRowObjectsJS().map((row) => Number(row.game_pk));
}

export async function readFeed(conn: DuckDBConnection, gamePk: number): Promise<unknown> {
  const reader = await conn.runAndReadAll("SELECT json FROM game_feeds WHERE game_pk = $gamePk", { gamePk });
  const [row] = reader.getRowObjectsJS();
  return row ? JSON.parse(String(row.json)) : null;
}

export async function deriveGame(conn: DuckDBConnection, gamePk: number) {
  return deriveGames(conn, [gamePk]);
}

export async function deriveGames(conn: DuckDBConnection, gamePks: number[]) {
  return inTransaction(conn, () => derive(conn, gamePks));
}

export async function rawFeedGamePks(conn: DuckDBConnection): Promise<number[]> {
  const reader = await conn.runAndReadAll("SELECT game_pk FROM game_feeds ORDER BY game_pk");
  return reader.getRowObjectsJS().map((row) => Number(row.game_pk));
}

function readFeedHeader(feed: unknown) {
  const header = (feed ?? {}) as FeedHeader;
  const gamePk = Number(header.gamePk);
  const season = Number(header.gameData?.game?.season);
  const feedTs = header.metaData?.timeStamp;
  if (!Number.isInteger(gamePk) || !Number.isInteger(season) || typeof feedTs !== "string") {
    throw new Error("Feed is missing gamePk, gameData.game.season or metaData.timeStamp");
  }
  return { gamePk, season, feedTs, isFinal: header.gameData?.status?.abstractGameState === "Final" };
}

async function derive(conn: DuckDBConnection, gamePks: number[]) {
  await runStatements(conn, await readSql("derive.sql"), { game_pks: listValue(gamePks) });

  const counts = await conn.runAndReadAll(
    `SELECT
       (SELECT count(*) FROM plays WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]))) AS plays,
       (SELECT count(*) FROM pitches WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]))) AS pitches,
       (SELECT list(DISTINCT season ORDER BY season) FROM game_feeds WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]))) AS seasons`,
    { game_pks: listValue(gamePks) },
  );
  const [row] = counts.getRowObjectsJS();
  return { plays: Number(row.plays), pitches: Number(row.pitches), seasons: (row.seasons ?? []) as number[] };
}
