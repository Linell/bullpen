import "server-only";
import type { DuckDBConnection } from "@duckdb/node-api";
import { inTransaction, runStatements } from "@/lib/db";

const SEASON_GAMES = `SELECT game_pk FROM games WHERE season = $season::INTEGER`;

const LATEST_FIRST = `ORDER BY source_date DESC, source_game_number DESC, game_pk DESC`;

const PLAYERS = [
  `DELETE FROM players
  WHERE source_game_pk IN (${SEASON_GAMES})
    OR player_id IN (SELECT player_id FROM game_player_bios WHERE game_pk IN (${SEASON_GAMES}))`,
  `INSERT INTO players BY NAME
  SELECT
    player_id, full_name, first_name, last_name, boxscore_name, bat_side, pitch_hand, birth_date, height,
    weight, mlb_debut_date, active, sz_top, sz_bottom,
    game_pk AS source_game_pk, source_date, source_game_number
  FROM game_player_bios
  WHERE player_id NOT IN (SELECT player_id FROM players)
  QUALIFY row_number() OVER (PARTITION BY player_id ${LATEST_FIRST}) = 1`,
];

const TEAMS = [
  `DELETE FROM teams WHERE season = $season::INTEGER`,
  `INSERT INTO teams BY NAME
  SELECT
    team_id, season, name, team_name, abbreviation, location_name, short_name, team_code,
    league_id, league_name, division_id, division_name, venue_id, venue_name,
    game_pk AS source_game_pk, source_date, source_game_number
  FROM game_teams
  WHERE season = $season::INTEGER
  QUALIFY row_number() OVER (PARTITION BY team_id ${LATEST_FIRST}) = 1`,
];

const GAME_STARTERS = [
  `DELETE FROM game_starters
  WHERE game_pk IN (${SEASON_GAMES} UNION SELECT game_pk FROM plays WHERE season = $season::INTEGER)`,
  `INSERT INTO game_starters BY NAME
  SELECT
    game_pk,
    CASE half WHEN 'top' THEN 'home' ELSE 'away' END::team_side AS side,
    arg_min(pitcher_id, at_bat_index) AS pitcher_id
  FROM plays
  WHERE season = $season::INTEGER
  GROUP BY ALL`,
];

const STATEMENTS = [...PLAYERS, ...TEAMS, ...GAME_STARTERS];

export async function refreshSeasonRollups(conn: DuckDBConnection, season: number) {
  await inTransaction(conn, () => runStatements(conn, STATEMENTS.join(";\n"), { season }));
}
