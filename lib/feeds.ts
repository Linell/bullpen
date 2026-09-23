import "server-only";
import type { DuckDBConnection } from "@duckdb/node-api";
import { readSql } from "@/lib/db";

type FeedHeader = {
  gamePk?: unknown;
  metaData?: { timeStamp?: unknown };
  gameData?: { game?: { season?: unknown } };
};

let deriveSql: Promise<string> | undefined;

export async function storeFeed(conn: DuckDBConnection, feed: unknown) {
  const { gamePk, season, feedTs } = readFeedHeader(feed);
  const stored = await conn.runAndReadAll(
    `INSERT INTO raw_game_feeds (game_pk, season, feed_ts, fetched_at, json)
     VALUES ($gamePk, $season, $feedTs, now(), $json)
     ON CONFLICT (game_pk) DO UPDATE SET
       season = excluded.season,
       feed_ts = excluded.feed_ts,
       fetched_at = excluded.fetched_at,
       json = excluded.json
     WHERE excluded.feed_ts > raw_game_feeds.feed_ts
     RETURNING game_pk`,
    { gamePk, season, feedTs, json: JSON.stringify(feed) },
  );
  const status = stored.currentRowCount > 0 ? ("stored" as const) : ("unchanged" as const);
  return { status, gamePk, feedTs };
}

export async function deriveGame(conn: DuckDBConnection, gamePk: number) {
  return inTransaction(conn, () => derive(conn, gamePk));
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

async function derive(conn: DuckDBConnection, gamePk: number) {
  deriveSql ??= readSql("derive.sql").catch((err) => {
    deriveSql = undefined;
    throw err;
  });
  const statements = await conn.extractStatements(await deriveSql);
  for (let i = 0; i < statements.count; i++) {
    const statement = await statements.prepare(i);
    if (statement.parameterCount > 0) statement.bind({ game_pk: gamePk });
    await statement.run();
  }

  const counts = await conn.runAndReadAll(
    `SELECT
       (SELECT count(*) FROM plays WHERE game_pk = $game_pk::INTEGER) AS plays,
       (SELECT count(*) FROM pitches WHERE game_pk = $game_pk::INTEGER) AS pitches`,
    { game_pk: gamePk },
  );
  const [row] = counts.getRowObjects();
  return { plays: Number(row.plays), pitches: Number(row.pitches) };
}

async function inTransaction<T>(conn: DuckDBConnection, work: () => Promise<T>) {
  await conn.run("BEGIN TRANSACTION");
  try {
    const result = await work();
    await conn.run("COMMIT");
    return result;
  } catch (err) {
    await conn.run("ROLLBACK").catch(() => {});
    throw err;
  }
}
