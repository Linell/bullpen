import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { dayTag, seasonRollupsTag } from "@/lib/cache-tags";
import { readRows } from "@/lib/db";
import type { PlayerRef } from "@/lib/player-ref";
import {
  NO_BATTING,
  NO_PITCHING,
  ratio,
  toBattingStats,
  toPitchingStats,
  type BattingCounts,
  type BattingStats,
  type PitchingCounts,
  type PitchingStats,
  type Rate,
} from "@/lib/stats/rates";
import type { EventBoard } from "@/lib/season-rollups";
import { BOX_BATTING_COUNTS, PITCHING_COUNTS, TRACKED_GAME } from "@/lib/stats/sql";

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

export type HittingLeader = { player: PlayerRef } & Pick<
  BattingStats,
  "plateAppearances" | "homeRuns" | "avg" | "obp" | "slg" | "ops" | "strikeoutRate" | "walkRate"
>;

export type PitchingLeader = { player: PlayerRef; strikeouts: number } & Pick<
  PitchingStats,
  "inningsPitched" | "era" | "strikeoutRate" | "walkRate" | "whip"
>;

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

type PlayerRow = { player_id: number; name: string };

type HittingRow = PlayerRow & Omit<BattingCounts, "batted_balls" | "hard_hits" | "barrels" | "exit_velocity">;

type PitchingRow = PlayerRow & PitchingCounts;

export const PLATE_APPEARANCES_PER_GAME_DAY = 3.1;
export const INNINGS_PER_GAME_DAY = 1;
export const BATTED_BALLS_PER_GAME_DAY = 1;
export const PITCHES_PER_GAME_DAY = 10;

const DAYS_IN_RANGE = `official_date BETWEEN $from::DATE AND $to::DATE`;

const IN_RANGE = `${DAYS_IN_RANGE} AND ${TRACKED_GAME}`;

const GAME_DAYS = `(SELECT count(DISTINCT official_date) FROM games WHERE ${IN_RANGE})`;

const GAMES_IN_RANGE = `SELECT game_pk FROM games WHERE ${IN_RANGE}`;

const playerName = (name: string, id: string) => `coalesce(${name}, 'Player ' || ${id}::VARCHAR)`;

function eventQuery(board: EventBoard) {
  return `
  SELECT l.player_id, ${playerName("p.full_name", "l.player_id")} AS name,
    l.opponent_id, ${playerName("o.full_name", "l.opponent_id")} AS opponent_name,
    l.value, l.pitch_type, l.count, l.result,
    l.game_pk, strftime(l.official_date, '%Y-%m-%d') AS date, away.abbreviation AS away, home.abbreviation AS home
  FROM event_leaders l
  JOIN games g ON g.game_pk = l.game_pk
  LEFT JOIN players p ON p.player_id = l.player_id
  LEFT JOIN players o ON o.player_id = l.opponent_id
  LEFT JOIN game_teams away ON away.game_pk = g.game_pk AND away.team_id = g.away_team_id
  LEFT JOIN game_teams home ON home.game_pk = g.game_pk AND home.team_id = g.home_team_id
  WHERE l.board = '${board}' AND l.official_date BETWEEN $from::DATE AND $to::DATE
  ORDER BY l.value DESC, l.official_date, l.game_pk, l.at_bat_index, l.pitch_index
  LIMIT $limit::INTEGER`;
}

const LONGEST_HOME_RUNS_QUERY = eventQuery("longest_home_runs");

const FASTEST_PITCHES_QUERY = eventQuery("fastest_pitches");

const HARDEST_HIT_BALLS_QUERY = eventQuery("hardest_hit_balls");

const BARREL_RATES_QUERY = `
  SELECT * FROM (
    SELECT d.player_id, ${playerName("any_value(pl.full_name)", "d.player_id")} AS name,
      sum(d.batted_balls) AS batted_balls,
      sum(d.hard_hits) AS hard_hits,
      sum(d.barrels) AS barrels,
      sum(d.launch_speed_sum) / nullif(sum(d.batted_balls), 0) AS exit_velocity
    FROM batted_ball_days d
    LEFT JOIN players pl ON pl.player_id = d.player_id
    WHERE ${DAYS_IN_RANGE}
    GROUP BY d.player_id
  )
  WHERE batted_balls >= ${BATTED_BALLS_PER_GAME_DAY} * ${GAME_DAYS}
  ORDER BY barrels / batted_balls DESC, hard_hits / batted_balls DESC, batted_balls DESC, player_id
  LIMIT $limit::INTEGER`;

const WHIFF_RATES_QUERY = `
  SELECT * FROM (
    SELECT d.player_id, ${playerName("any_value(pl.full_name)", "d.player_id")} AS name,
      sum(d.pitches) AS pitches,
      sum(d.swings) AS swings,
      sum(d.whiffs) AS whiffs,
      sum(d.called_strikes) AS called_strikes,
      sum(d.out_of_zone_pitches) AS out_of_zone_pitches,
      sum(d.chases) AS chases
    FROM pitch_outcome_days d
    LEFT JOIN players pl ON pl.player_id = d.player_id
    WHERE ${DAYS_IN_RANGE}
    GROUP BY d.player_id
  )
  WHERE pitches >= ${PITCHES_PER_GAME_DAY} * ${GAME_DAYS} AND swings > 0
  ORDER BY whiffs / swings DESC, (called_strikes + whiffs) / pitches DESC, pitches DESC, player_id
  LIMIT $limit::INTEGER`;

const HITTING_QUERY = `
  SELECT * FROM (
    SELECT b.player_id, ${playerName("any_value(pl.full_name)", "b.player_id")} AS name, ${BOX_BATTING_COUNTS}
    FROM player_game_batting b
    LEFT JOIN players pl ON pl.player_id = b.player_id
    WHERE b.game_pk IN (${GAMES_IN_RANGE})
    GROUP BY b.player_id
  )
  WHERE plate_appearances >= ${PLATE_APPEARANCES_PER_GAME_DAY} * ${GAME_DAYS}
  ORDER BY (hits + walks + hit_by_pitch) / nullif(at_bats + walks + hit_by_pitch + sac_flies, 0)
      + total_bases / nullif(at_bats, 0) DESC NULLS LAST,
    plate_appearances DESC, player_id
  LIMIT $limit::INTEGER`;

const PITCHING_QUERY = `
  SELECT * FROM (
    SELECT p.player_id, ${playerName("any_value(pl.full_name)", "p.player_id")} AS name, ${PITCHING_COUNTS}
    FROM player_game_pitching p
    LEFT JOIN players pl ON pl.player_id = p.player_id
    WHERE p.game_pk IN (${GAMES_IN_RANGE})
    GROUP BY p.player_id
  )
  WHERE outs >= 3 * ${INNINGS_PER_GAME_DAY} * ${GAME_DAYS} AND outs > 0
  ORDER BY earned_runs / outs, outs DESC, player_id
  LIMIT $limit::INTEGER`;

function toHittingLeader({ player_id, name, ...counts }: HittingRow): HittingLeader {
  const stats = toBattingStats({ ...NO_BATTING, ...counts });
  return {
    player: { id: player_id, name },
    plateAppearances: stats.plateAppearances,
    homeRuns: stats.homeRuns,
    avg: stats.avg,
    obp: stats.obp,
    slg: stats.slg,
    ops: stats.ops,
    strikeoutRate: stats.strikeoutRate,
    walkRate: stats.walkRate,
  };
}

function toPitchingLeader({ player_id, name, ...counts }: PitchingRow): PitchingLeader {
  const stats = toPitchingStats({ ...NO_PITCHING, ...counts });
  return {
    player: { id: player_id, name },
    inningsPitched: stats.inningsPitched,
    era: stats.era,
    strikeouts: counts.strikeouts,
    strikeoutRate: stats.strikeoutRate,
    walkRate: stats.walkRate,
    whip: stats.whip,
  };
}

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

function rollupTags({ from, to }: LeaderboardQuery) {
  return [...new Set([from, to].map((date) => seasonRollupsTag(Number(date.slice(0, 4))))), dayTag(to)];
}

async function readLeaders<Row, Leader>(query: string, params: LeaderboardQuery, toLeader: (row: Row) => Leader) {
  const rows = await readRows<Row>(query, params);
  return rows.map(toLeader);
}

export async function longestHomeRuns(query: LeaderboardQuery): Promise<EventLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(LONGEST_HOME_RUNS_QUERY, query, toEventLeader);
}

export async function fastestPitches(query: LeaderboardQuery): Promise<EventLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(FASTEST_PITCHES_QUERY, query, toEventLeader);
}

export async function hardestHitBalls(query: LeaderboardQuery): Promise<EventLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(HARDEST_HIT_BALLS_QUERY, query, toEventLeader);
}

export async function barrelRates(query: LeaderboardQuery): Promise<BarrelLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(BARREL_RATES_QUERY, query, toBarrelLeader);
}

export async function whiffRates(query: LeaderboardQuery): Promise<WhiffLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(WHIFF_RATES_QUERY, query, toWhiffLeader);
}

export async function hittingLeaders(query: LeaderboardQuery): Promise<HittingLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(HITTING_QUERY, query, toHittingLeader);
}

export async function pitchingLeaders(query: LeaderboardQuery): Promise<PitchingLeader[]> {
  "use cache: remote";
  cacheTag(...rollupTags(query));
  cacheLife("hours");
  return readLeaders(PITCHING_QUERY, query, toPitchingLeader);
}
