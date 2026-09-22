import "server-only";
import { INTEGER, type DuckDBConnection } from "@duckdb/node-api";
import { readSql } from "@/lib/db";

type FeedHeader = {
  gamePk?: unknown;
  metaData?: { timeStamp?: unknown };
  gameData?: { game?: { season?: unknown } };
};

// Stores a game feed unless the stored copy has the same metaData.timeStamp.
export async function upsertRawFeed(conn: DuckDBConnection, feed: unknown) {
  const f = (feed ?? {}) as FeedHeader;
  const gamePk = Number(f.gamePk);
  const season = Number(f.gameData?.game?.season);
  const feedTs = f.metaData?.timeStamp;
  if (!Number.isInteger(gamePk) || !Number.isInteger(season) || typeof feedTs !== "string") {
    throw new Error("Feed is missing gamePk, gameData.game.season or metaData.timeStamp");
  }

  const existing = await conn.runAndReadAll(
    "SELECT feed_ts FROM raw_game_feeds WHERE game_pk = $gamePk",
    { gamePk },
  );
  if (existing.getRowObjects()[0]?.feed_ts === feedTs) {
    return { status: "unchanged" as const, gamePk, season, feedTs };
  }

  await conn.run(
    `INSERT OR REPLACE INTO raw_game_feeds (game_pk, season, feed_ts, fetched_at, json)
     VALUES ($gamePk, $season, $feedTs, now(), $json)`,
    { gamePk, season, feedTs, json: JSON.stringify(feed) },
  );
  return { status: "stored" as const, gamePk, season, feedTs };
}

// Rebuilds one game's derived rows (or every game's when gamePk is null) and returns the
// resulting counts. Named parameters can't be bound to a multi-statement string, so each
// statement of derive.sql is prepared and run in turn.
export async function deriveGame(conn: DuckDBConnection, gamePk: number | null) {
  const statements = await conn.extractStatements(await readSql("derive.sql"));
  for (let i = 0; i < statements.count; i++) {
    const stmt = await statements.prepare(i);
    if (stmt.parameterCount > 0) stmt.bind({ game_pk: gamePk }, { game_pk: INTEGER });
    await stmt.run();
  }

  const counts = await conn.runAndReadAll(
    `SELECT
       (SELECT count(*) FROM plate_appearances WHERE $game_pk IS NULL OR game_pk = $game_pk) AS pa,
       (SELECT count(*) FROM pitches WHERE $game_pk IS NULL OR game_pk = $game_pk) AS pitches`,
    { game_pk: gamePk },
    { game_pk: INTEGER },
  );
  const row = counts.getRowObjects()[0];
  return { plateAppearances: Number(row.pa), pitches: Number(row.pitches) };
}
