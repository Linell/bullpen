import "server-only";
import { listValue } from "@duckdb/node-api";
import { cacheLife, cacheTag } from "next/cache";
import { LEADERBOARDS_TAG } from "@/lib/cache-tags";
import { readRows } from "@/lib/db";
import type { PlayerRef } from "@/lib/player-ref";

export const REGULAR_AND_POSTSEASON = ["R", "F", "D", "L", "W"];

export type LeaderboardRange = {
  from: string;
  to: string;
  limit?: number;
  gameTypes?: string[];
};

export type Leader = {
  player: PlayerRef;
  value: number;
  gamePk: number;
  date: string;
  matchup: string;
};

type LeaderRow = {
  player_id: number;
  name: string;
  value: number;
  game_pk: number;
  date: string;
  away: string | null;
  home: string | null;
};

const GAME_COLUMNS = `
  e.game_pk, strftime(g.official_date, '%Y-%m-%d') AS date, away.abbreviation AS away, home.abbreviation AS home`;

const GAME_JOINS = `
  JOIN games g ON g.game_pk = e.game_pk
  LEFT JOIN game_teams away ON away.game_pk = g.game_pk AND away.team_id = g.away_team_id
  LEFT JOIN game_teams home ON home.game_pk = g.game_pk AND home.team_id = g.home_team_id`;

const IN_RANGE = `
  g.official_date BETWEEN $from::DATE AND $to::DATE AND list_contains($gameTypes::VARCHAR[], g.game_type)`;

const LONGEST_HOME_RUNS_QUERY = `
  SELECT e.batter_id AS player_id, p.full_name AS name, e.total_distance AS value, ${GAME_COLUMNS}
  FROM plays e
  ${GAME_JOINS}
  JOIN players p ON p.player_id = e.batter_id
  WHERE ${IN_RANGE} AND e.event_type = 'home_run' AND e.total_distance IS NOT NULL
  ORDER BY value DESC, g.official_date, e.game_pk, e.at_bat_index
  LIMIT $limit::INTEGER`;

const FASTEST_PITCHES_QUERY = `
  SELECT e.pitcher_id AS player_id, p.full_name AS name, e.start_speed AS value, ${GAME_COLUMNS}
  FROM pitches e
  ${GAME_JOINS}
  JOIN players p ON p.player_id = e.pitcher_id
  WHERE ${IN_RANGE} AND e.start_speed IS NOT NULL
  ORDER BY value DESC, g.official_date, e.game_pk, e.at_bat_index, e.pitch_index
  LIMIT $limit::INTEGER`;

const HARDEST_HIT_BALLS_QUERY = `
  SELECT e.batter_id AS player_id, p.full_name AS name, e.launch_speed AS value, ${GAME_COLUMNS}
  FROM pitches e
  ${GAME_JOINS}
  JOIN players p ON p.player_id = e.batter_id
  WHERE ${IN_RANGE} AND e.is_in_play AND e.launch_speed IS NOT NULL
  ORDER BY value DESC, g.official_date, e.game_pk, e.at_bat_index, e.pitch_index
  LIMIT $limit::INTEGER`;

function toLeader(r: LeaderRow): Leader {
  return {
    player: { id: r.player_id, name: r.name },
    value: r.value,
    gamePk: r.game_pk,
    date: r.date,
    matchup: `${r.away ?? "Away"} @ ${r.home ?? "Home"}`,
  };
}

async function readLeaders(query: string, { from, to, limit = 3, gameTypes = REGULAR_AND_POSTSEASON }: LeaderboardRange) {
  const rows = await readRows<LeaderRow>(query, { from, to, limit, gameTypes: listValue(gameTypes) });
  return rows.map(toLeader);
}

export async function longestHomeRuns(range: LeaderboardRange): Promise<Leader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(LONGEST_HOME_RUNS_QUERY, range);
}

export async function fastestPitches(range: LeaderboardRange): Promise<Leader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(FASTEST_PITCHES_QUERY, range);
}

export async function hardestHitBalls(range: LeaderboardRange): Promise<Leader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(HARDEST_HIT_BALLS_QUERY, range);
}
