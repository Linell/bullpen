import "server-only";
import { type DuckDBConnection, listValue } from "@duckdb/node-api";
import { readSql } from "@/lib/db";
import { inTransaction, runStatements } from "@/lib/statements";

type FeedHeader = {
  gamePk?: unknown;
  metaData?: { timeStamp?: unknown };
  gameData?: { game?: { season?: unknown } };
};

let deriveSql: Promise<string> | undefined;

export async function storeFeed(conn: DuckDBConnection, feed: unknown) {
  const { gamePk, season, feedTs } = readFeedHeader(feed);
  const stored = await storeFeeds(conn, [feed]);
  const status = stored.length > 0 ? ("stored" as const) : ("unchanged" as const);
  return { status, gamePk, season, feedTs };
}

export async function storeFeeds(conn: DuckDBConnection, feeds: unknown[]): Promise<number[]> {
  if (feeds.length === 0) return [];
  const headers = feeds.map(readFeedHeader);
  const stored = await conn.runAndReadAll(
    `INSERT INTO raw_game_feeds (game_pk, season, feed_ts, fetched_at, json)
     SELECT unnest($gamePks::INTEGER[]), unnest($seasons::INTEGER[]), unnest($feedTs::VARCHAR[]), now(), unnest($jsons::VARCHAR[])
     ON CONFLICT (game_pk) DO UPDATE SET
       season = excluded.season,
       feed_ts = excluded.feed_ts,
       fetched_at = excluded.fetched_at,
       json = excluded.json
     WHERE excluded.feed_ts > raw_game_feeds.feed_ts
     RETURNING game_pk`,
    {
      gamePks: listValue(headers.map((header) => header.gamePk)),
      seasons: listValue(headers.map((header) => header.season)),
      feedTs: listValue(headers.map((header) => header.feedTs)),
      jsons: listValue(feeds.map((feed) => JSON.stringify(feed))),
    },
  );
  return stored.getRowObjectsJS().map((row) => Number(row.game_pk));
}

export async function readFeed(conn: DuckDBConnection, gamePk: number): Promise<unknown> {
  const reader = await conn.runAndReadAll("SELECT json FROM raw_game_feeds WHERE game_pk = $gamePk", { gamePk });
  const [row] = reader.getRowObjectsJS();
  return row ? JSON.parse(String(row.json)) : null;
}

export async function deriveGame(conn: DuckDBConnection, gamePk: number) {
  return deriveGames(conn, [gamePk]);
}

export async function deriveGames(conn: DuckDBConnection, gamePks: number[]) {
  return inTransaction(conn, () => derive(conn, gamePks));
}

export async function rawFeedSeasons(conn: DuckDBConnection, gamePks: number[]): Promise<number[]> {
  const reader = await conn.runAndReadAll(
    "SELECT DISTINCT season FROM raw_game_feeds WHERE list_contains($gamePks::INTEGER[], game_pk) ORDER BY season",
    { gamePks: listValue(gamePks) },
  );
  return reader.getRowObjectsJS().map((row) => Number(row.season));
}

export async function rawFeedGamePks(conn: DuckDBConnection): Promise<number[]> {
  const reader = await conn.runAndReadAll("SELECT game_pk FROM raw_game_feeds ORDER BY game_pk");
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
  return { gamePk, season, feedTs };
}

async function derive(conn: DuckDBConnection, gamePks: number[]) {
  deriveSql ??= readSql("derive.sql").catch((err) => {
    deriveSql = undefined;
    throw err;
  });
  await runStatements(conn, await deriveSql, { game_pks: listValue(gamePks) });

  const counts = await conn.runAndReadAll(
    `SELECT
       (SELECT count(*) FROM plays WHERE list_contains($game_pks::INTEGER[], game_pk)) AS plays,
       (SELECT count(*) FROM pitches WHERE list_contains($game_pks::INTEGER[], game_pk)) AS pitches`,
    { game_pks: listValue(gamePks) },
  );
  const [row] = counts.getRowObjects();
  return { plays: Number(row.plays), pitches: Number(row.pitches) };
}
