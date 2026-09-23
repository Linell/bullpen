import type { DuckDBConnection } from "@duckdb/node-api";

export async function recordProbables(
  conn: DuckDBConnection,
  gamePks: number[],
): Promise<number[]> {
  if (gamePks.length === 0) return [];
  if (!gamePks.every(Number.isInteger)) throw new Error("gamePk must be an integer");
  const pks = gamePks.join(",");
  const reader = await conn.runAndReadAll(
    `INSERT INTO probable_pitchers (game_pk, side, pitcher_id, pitcher_name, observed_at)
     SELECT current.game_pk, current.side, current.pitcher_id, current.pitcher_name, now()
     FROM (
       SELECT game_pk, 'home'::team_side AS side, home_probable_id AS pitcher_id,
              home_probable_name AS pitcher_name
       FROM games WHERE game_pk IN (${pks})
       UNION ALL
       SELECT game_pk, 'away'::team_side, away_probable_id, away_probable_name
       FROM games WHERE game_pk IN (${pks})
     ) AS current
     LEFT JOIN (
       SELECT game_pk, side, pitcher_id, pitcher_name
       FROM probable_pitchers WHERE game_pk IN (${pks})
       QUALIFY row_number() OVER (PARTITION BY game_pk, side ORDER BY observed_at DESC) = 1
     ) AS latest USING (game_pk, side)
     WHERE current.pitcher_id IS DISTINCT FROM latest.pitcher_id
        OR current.pitcher_name IS DISTINCT FROM latest.pitcher_name
     RETURNING game_pk`,
  );
  return [...new Set(reader.getRowObjectsJS().map((row) => Number(row.game_pk)))];
}
