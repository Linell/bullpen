import "server-only";
import { INTEGER, type DuckDBConnection } from "@duckdb/node-api";
import { readSql } from "@/lib/db";

type FeedHeader = {
  gamePk?: unknown;
  metaData?: { timeStamp?: unknown };
  gameData?: { game?: { season?: unknown } };
};

let deriveSql: Promise<string> | undefined;

export async function ingestFeed(conn: DuckDBConnection, feed: unknown) {
  const { gamePk, season, feedTs } = readFeedHeader(feed);
  return inTransaction(conn, async () => {
    const stored = await conn.runAndReadAll(
      `INSERT INTO raw_game_feeds (game_pk, season, feed_ts, fetched_at, json)
       VALUES ($gamePk, $season, $feedTs, now(), $json)
       ON CONFLICT (game_pk) DO UPDATE SET
         season = excluded.season,
         feed_ts = excluded.feed_ts,
         fetched_at = excluded.fetched_at,
         json = excluded.json
       WHERE excluded.feed_ts <> raw_game_feeds.feed_ts
       RETURNING game_pk`,
      { gamePk, season, feedTs, json: JSON.stringify(feed) },
    );
    if (stored.currentRowCount === 0) {
      return { status: "unchanged" as const, gamePk, season, feedTs };
    }
    return { status: "stored" as const, gamePk, season, feedTs, ...(await derive(conn, gamePk)) };
  });
}

export async function rebuildDerived(conn: DuckDBConnection, gamePk: number | null) {
  return inTransaction(conn, () => derive(conn, gamePk));
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

async function derive(conn: DuckDBConnection, gamePk: number | null) {
  deriveSql ??= readSql("derive.sql").catch((err) => {
    deriveSql = undefined;
    throw err;
  });
  const statements = await conn.extractStatements(await deriveSql);
  for (let i = 0; i < statements.count; i++) {
    const statement = await statements.prepare(i);
    if (statement.parameterCount > 0) statement.bind({ game_pk: gamePk }, { game_pk: INTEGER });
    await statement.run();
  }

  const counts = await conn.runAndReadAll(
    `SELECT
       (SELECT count(*) FROM plays WHERE $game_pk IS NULL OR game_pk = $game_pk) AS plays,
       (SELECT count(*) FROM pitches WHERE $game_pk IS NULL OR game_pk = $game_pk) AS pitches`,
    { game_pk: gamePk },
    { game_pk: INTEGER },
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
