import type { DuckDBConnection } from "@duckdb/node-api";
import { LIMITS } from "./leaderboard-range.ts";
import { inTransaction, runStatements } from "./statements.ts";
import {
  BATTED_BALL_TOTALS,
  BATTER_SPLITS,
  BATTING_COUNTS,
  PITCH_COUNTS,
  PITCH_TOTALS,
  PITCHING_COUNTS,
  SWING_DECISION_COUNTS,
  TRACKED_GAME,
  TRACKED_SEASON,
  TRACKED_SEASON_GAMES,
} from "./stats/sql.ts";

export const EVENT_BOARDS = {
  longest_home_runs: {
    credit: "batter",
    value: "a.total_distance",
    where: "e.is_in_play AND a.event_type = 'home_run' AND a.total_distance IS NOT NULL",
  },
  fastest_pitches: { credit: "pitcher", value: "e.start_speed", where: "e.start_speed IS NOT NULL" },
  hardest_hit_balls: { credit: "batter", value: "e.launch_speed", where: "e.is_in_play AND e.launch_speed IS NOT NULL" },
} satisfies Record<string, { credit: "batter" | "pitcher"; value: string; where: string }>;

export type EventBoard = keyof typeof EVENT_BOARDS;

const EVENT_LEADERS_PER_DAY = Math.max(...LIMITS);

const SEASON_GAMES = `SELECT game_pk FROM games WHERE season = $season::INTEGER`;

const LATEST_FIRST = `ORDER BY source_date DESC, source_game_number DESC, game_pk DESC`;

const PLAYERS = [
  // Re-pick touched players' latest bio from any season.
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
  // Top half: home team pitching.
  `INSERT INTO game_starters BY NAME
  SELECT
    game_pk,
    CASE half WHEN 'top' THEN 'home' ELSE 'away' END::team_side AS side,
    arg_min(pitcher_id, at_bat_index) AS pitcher_id
  FROM plays
  WHERE season = $season::INTEGER
  GROUP BY ALL`,
];

const SEASON_SCOPE = (alias = "") => `${alias}season = $season::INTEGER`;

const GAME_DAY_SCOPE = (alias = "") =>
  `${alias}official_date = (SELECT official_date FROM games WHERE game_pk = $gamePk::INTEGER)`;

type Scope = typeof SEASON_SCOPE;

function eventLeaders(board: EventBoard, scope: Scope) {
  const { credit, value, where } = EVENT_BOARDS[board];
  const opponent = credit === "batter" ? "pitcher" : "batter";
  return `INSERT INTO event_leaders BY NAME
  SELECT '${board}' AS board, g.season, g.official_date,
    e.${credit}_id AS player_id, e.${opponent}_id AS opponent_id, ${value} AS value,
    e.pitch_type_desc AS pitch_type, e.balls_before || '-' || e.strikes_before AS count,
    CASE WHEN e.is_in_play THEN a.event ELSE e.call_desc END AS result,
    e.game_pk, e.at_bat_index, e.pitch_index
  FROM pitches e
  JOIN games g ON g.game_pk = e.game_pk
  LEFT JOIN plays a ON a.game_pk = e.game_pk AND a.at_bat_index = e.at_bat_index
  WHERE ${scope("g.")} AND ${TRACKED_GAME} AND ${where}
  QUALIFY rank() OVER (
    PARTITION BY g.official_date ORDER BY ${value} DESC, e.game_pk, e.at_bat_index, e.pitch_index
  ) <= ${EVENT_LEADERS_PER_DAY}`;
}

function playerSeasonCounts(role: "batter" | "pitcher") {
  return `INSERT INTO player_season_counts BY NAME
  WITH batting AS (
    SELECT ${role}_id AS player_id, ${BATTING_COUNTS}
    FROM plate_appearances
    WHERE ${TRACKED_SEASON}
    GROUP BY ${role}_id
  ),
  pitch_totals AS (
    SELECT ${role}_id AS player_id, ${PITCH_COUNTS}, ${SWING_DECISION_COUNTS}
    FROM pitch_outcomes
    WHERE ${TRACKED_SEASON}
    GROUP BY ${role}_id
  )
  SELECT $season::INTEGER AS season, '${role}' AS role, *
  FROM batting
  LEFT JOIN pitch_totals USING (player_id)`;
}

const DAY_ROLLUP_TABLES = ["event_leaders", "batted_ball_days", "pitch_outcome_days"];

const SEASON_ROLLUP_TABLES = [
  "player_season_counts",
  "team_season_batting",
  "team_season_swing_decisions",
  "team_season_pitching",
  "team_season_pitches",
];

function dayRollups(scope: Scope) {
  return [
    ...DAY_ROLLUP_TABLES.map((table) => `DELETE FROM ${table} WHERE ${scope()}`),
    eventLeaders("longest_home_runs", scope),
    eventLeaders("fastest_pitches", scope),
    eventLeaders("hardest_hit_balls", scope),
    `INSERT INTO batted_ball_days BY NAME
  SELECT season, official_date, batter_id AS player_id, ${BATTED_BALL_TOTALS}, sum(launch_speed) AS launch_speed_sum
  FROM plate_appearances
  WHERE ${scope()} AND ${TRACKED_GAME}
  GROUP BY season, official_date, batter_id`,
    `INSERT INTO pitch_outcome_days BY NAME
  SELECT season, official_date, pitcher_id AS player_id, ${PITCH_TOTALS}, ${SWING_DECISION_COUNTS}
  FROM pitch_outcomes
  WHERE ${scope()} AND ${TRACKED_GAME}
  GROUP BY season, official_date, pitcher_id`,
  ];
}

const ROLLUPS = [
  ...dayRollups(SEASON_SCOPE),
  ...SEASON_ROLLUP_TABLES.map((table) => `DELETE FROM ${table} WHERE season = $season::INTEGER`),
  playerSeasonCounts("batter"),
  playerSeasonCounts("pitcher"),
  `INSERT INTO team_season_batting BY NAME
  WITH splits AS (
    SELECT *, ${BATTER_SPLITS} AS split
    FROM plate_appearances
    WHERE ${TRACKED_SEASON}
  )
  SELECT $season::INTEGER AS season, batting_team_id AS team_id, split,
    CASE grouping(batting_team_id) WHEN 1 THEN 'league' ELSE 'team' END AS scope,
    greatest(count(DISTINCT batting_team_id), 1) AS teams,
    count(DISTINCT game_pk) AS games,
    ${BATTING_COUNTS}
  FROM splits
  WHERE split IS NOT NULL
  GROUP BY GROUPING SETS ((split, batting_team_id), (split))`,
  `INSERT INTO team_season_swing_decisions BY NAME
  SELECT $season::INTEGER AS season, batting_team_id AS team_id,
    CASE grouping(batting_team_id) WHEN 1 THEN 'league' ELSE 'team' END AS scope,
    ${SWING_DECISION_COUNTS}
  FROM pitch_outcomes
  WHERE ${TRACKED_SEASON}
  GROUP BY GROUPING SETS ((batting_team_id), ())`,
  `INSERT INTO team_season_pitching BY NAME
  SELECT $season::INTEGER AS season, team_id,
    CASE
      WHEN grouping(team_id) = 1 THEN 'league'
      WHEN grouping(is_starter) = 1 THEN 'team'
      WHEN is_starter THEN 'starters'
      ELSE 'bullpen'
    END AS scope,
    greatest(count(DISTINCT team_id), 1) AS teams,
    ${PITCHING_COUNTS}
  FROM player_game_pitching
  WHERE game_pk IN (${TRACKED_SEASON_GAMES})
  GROUP BY GROUPING SETS ((team_id, is_starter), (team_id), ())`,
  `INSERT INTO team_season_pitches BY NAME
  WITH pitcher_roles AS (
    SELECT game_pk, team_id AS fielding_team_id, player_id AS pitcher_id, is_starter
    FROM player_game_pitching
  ),
  scoped AS (
    SELECT $season::INTEGER AS season, fielding_team_id AS team_id,
      CASE
        WHEN grouping(fielding_team_id) = 1 THEN 'league'
        WHEN grouping(is_starter) = 1 THEN 'team'
        WHEN is_starter THEN 'starters'
        WHEN NOT is_starter THEN 'bullpen'
      END AS scope,
      ${PITCH_COUNTS}
    FROM pitch_outcomes
    LEFT JOIN pitcher_roles USING (game_pk, fielding_team_id, pitcher_id)
    WHERE ${TRACKED_SEASON}
    GROUP BY GROUPING SETS ((fielding_team_id, is_starter), (fielding_team_id), ())
  )
  SELECT * FROM scoped WHERE scope IS NOT NULL`,
];

const STATEMENTS = [...PLAYERS, ...TEAMS, ...GAME_STARTERS, ...ROLLUPS].join(";\n");

const SEASONS = "SELECT season FROM games UNION SELECT season FROM game_teams UNION SELECT season FROM plays ORDER BY season";

function writeSeasonRollups(conn: DuckDBConnection, season: number) {
  return runStatements(conn, STATEMENTS, { season });
}

export async function refreshSeasonRollups(conn: DuckDBConnection, season: number) {
  await inTransaction(conn, () => writeSeasonRollups(conn, season));
}

export async function refreshGameDayRollups(conn: DuckDBConnection, gamePk: number) {
  await inTransaction(conn, () => runStatements(conn, dayRollups(GAME_DAY_SCOPE).join(";\n"), { gamePk }));
}

export async function writeAllSeasonRollups(conn: DuckDBConnection) {
  const reader = await conn.runAndReadAll(SEASONS);
  for (const { season } of reader.getRowObjectsJS()) await writeSeasonRollups(conn, Number(season));
}
