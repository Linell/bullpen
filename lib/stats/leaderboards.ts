import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LEADERBOARDS_TAG } from "@/lib/cache-tags";
import { readRows } from "@/lib/db";
import type { PlayerRef } from "@/lib/player-ref";
import { ratio, type Rate } from "@/lib/stats/rates";
import { BATTED_BALL_COUNTS, PITCH_COUNTS, SWING_DECISION_COUNTS, TRACKED_GAME, withNumbers } from "@/lib/stats/sql";

export type LeaderboardQuery = {
  from: string;
  to: string;
  limit: number;
};

export type EventLeader = {
  player: PlayerRef;
  opponent: PlayerRef;
  value: number;
  pitchType: string | null;
  count: string;
  result: string | null;
  gamePk: number;
  date: string;
  matchup: string;
};

export type BarrelLeader = {
  player: PlayerRef;
  battedBalls: number;
  barrelRate: Rate;
  hardHitRate: Rate;
  exitVelocity: Rate;
};

export type WhiffLeader = {
  player: PlayerRef;
  pitches: number;
  whiffRate: Rate;
  chaseRate: Rate;
  cswRate: Rate;
};

type EventRow = {
  player_id: number;
  name: string;
  opponent_id: number;
  opponent_name: string;
  value: number;
  pitch_type: string | null;
  count: string;
  result: string | null;
  game_pk: number;
  date: string;
  away: string | null;
  home: string | null;
};

type BarrelRow = {
  player_id: number;
  name: string;
  batted_balls: number;
  hard_hits: number;
  barrels: number;
  exit_velocity: number | null;
};

type WhiffRow = {
  player_id: number;
  name: string;
  pitches: number;
  swings: number;
  whiffs: number;
  called_strikes: number;
  out_of_zone_pitches: number;
  chases: number;
};

export const BATTED_BALLS_PER_GAME_DAY = 1;
export const PITCHES_PER_GAME_DAY = 10;

const IN_RANGE = `official_date BETWEEN $from::DATE AND $to::DATE AND ${TRACKED_GAME}`;

const GAME_DAYS = `(SELECT count(DISTINCT official_date) FROM games WHERE ${IN_RANGE})`;

const playerName = (name: string, id: string) => `coalesce(${name}, 'Player ' || ${id}::VARCHAR)`;

function eventQuery(credit: "batter" | "pitcher", value: string, where: string) {
  const opponent = credit === "batter" ? "pitcher" : "batter";
  return `
  SELECT e.${credit}_id AS player_id, ${playerName("p.full_name", `e.${credit}_id`)} AS name,
    e.${opponent}_id AS opponent_id, ${playerName("o.full_name", `e.${opponent}_id`)} AS opponent_name,
    ${value} AS value, e.pitch_type_desc AS pitch_type, e.balls_before || '-' || e.strikes_before AS count,
    CASE WHEN e.is_in_play THEN a.event ELSE e.call_desc END AS result,
    e.game_pk, strftime(g.official_date, '%Y-%m-%d') AS date, away.abbreviation AS away, home.abbreviation AS home
  FROM pitches e
  JOIN games g ON g.game_pk = e.game_pk
  LEFT JOIN plays a ON a.game_pk = e.game_pk AND a.at_bat_index = e.at_bat_index
  LEFT JOIN players p ON p.player_id = e.${credit}_id
  LEFT JOIN players o ON o.player_id = e.${opponent}_id
  LEFT JOIN game_teams away ON away.game_pk = g.game_pk AND away.team_id = g.away_team_id
  LEFT JOIN game_teams home ON home.game_pk = g.game_pk AND home.team_id = g.home_team_id
  WHERE ${IN_RANGE} AND ${where}
  ORDER BY value DESC, g.official_date, e.game_pk, e.at_bat_index, e.pitch_index
  LIMIT $limit::INTEGER`;
}

const LONGEST_HOME_RUNS_QUERY = eventQuery(
  "batter",
  "a.total_distance",
  "e.is_in_play AND a.event_type = 'home_run' AND a.total_distance IS NOT NULL",
);

const FASTEST_PITCHES_QUERY = eventQuery("pitcher", "e.start_speed", "e.start_speed IS NOT NULL");

const HARDEST_HIT_BALLS_QUERY = eventQuery("batter", "e.launch_speed", "e.is_in_play AND e.launch_speed IS NOT NULL");

const BARREL_RATES_QUERY = withNumbers(
  `SELECT pa.batter_id AS player_id, ${playerName("any_value(pl.full_name)", "pa.batter_id")} AS name, ${BATTED_BALL_COUNTS}
  FROM plate_appearances pa
  LEFT JOIN players pl ON pl.player_id = pa.batter_id
  WHERE ${IN_RANGE}
  GROUP BY pa.batter_id
  HAVING batted_balls >= ${BATTED_BALLS_PER_GAME_DAY} * ${GAME_DAYS}
  ORDER BY barrels / batted_balls DESC, hard_hits / batted_balls DESC, batted_balls DESC, player_id
  LIMIT $limit::INTEGER`,
  ["player_id", "name"],
);

const WHIFF_RATES_QUERY = withNumbers(
  `SELECT po.pitcher_id AS player_id, ${playerName("any_value(pl.full_name)", "po.pitcher_id")} AS name,
    ${PITCH_COUNTS}, ${SWING_DECISION_COUNTS}
  FROM pitch_outcomes po
  LEFT JOIN players pl ON pl.player_id = po.pitcher_id
  WHERE ${IN_RANGE}
  GROUP BY po.pitcher_id
  HAVING pitches >= ${PITCHES_PER_GAME_DAY} * ${GAME_DAYS} AND swings > 0
  ORDER BY whiffs / swings DESC, (called_strikes + whiffs) / pitches DESC, pitches DESC, player_id
  LIMIT $limit::INTEGER`,
  ["player_id", "name"],
);

function toEventLeader(r: EventRow): EventLeader {
  return {
    player: { id: r.player_id, name: r.name },
    opponent: { id: r.opponent_id, name: r.opponent_name },
    value: r.value,
    pitchType: r.pitch_type,
    count: r.count,
    result: r.result,
    gamePk: r.game_pk,
    date: r.date,
    matchup: `${r.away ?? "Away"} @ ${r.home ?? "Home"}`,
  };
}

function toBarrelLeader(r: BarrelRow): BarrelLeader {
  return {
    player: { id: r.player_id, name: r.name },
    battedBalls: r.batted_balls,
    barrelRate: ratio(r.barrels, r.batted_balls),
    hardHitRate: ratio(r.hard_hits, r.batted_balls),
    exitVelocity: r.exit_velocity,
  };
}

function toWhiffLeader(r: WhiffRow): WhiffLeader {
  return {
    player: { id: r.player_id, name: r.name },
    pitches: r.pitches,
    whiffRate: ratio(r.whiffs, r.swings),
    chaseRate: ratio(r.chases, r.out_of_zone_pitches),
    cswRate: ratio(r.called_strikes + r.whiffs, r.pitches),
  };
}

async function readLeaders<Row, Leader>(query: string, params: LeaderboardQuery, toLeader: (row: Row) => Leader) {
  const rows = await readRows<Row>(query, params);
  return rows.map(toLeader);
}

export async function longestHomeRuns(query: LeaderboardQuery): Promise<EventLeader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(LONGEST_HOME_RUNS_QUERY, query, toEventLeader);
}

export async function fastestPitches(query: LeaderboardQuery): Promise<EventLeader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(FASTEST_PITCHES_QUERY, query, toEventLeader);
}

export async function hardestHitBalls(query: LeaderboardQuery): Promise<EventLeader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(HARDEST_HIT_BALLS_QUERY, query, toEventLeader);
}

export async function barrelRates(query: LeaderboardQuery): Promise<BarrelLeader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(BARREL_RATES_QUERY, query, toBarrelLeader);
}

export async function whiffRates(query: LeaderboardQuery): Promise<WhiffLeader[]> {
  "use cache: remote";
  cacheTag(LEADERBOARDS_TAG);
  cacheLife("hours");
  return readLeaders(WHIFF_RATES_QUERY, query, toWhiffLeader);
}
