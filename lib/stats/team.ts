import "server-only";
import { cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { seasonRollupsTag, ALL_STATS_TAG, teamStatsTag } from "@/lib/cache-tags";
import { seasonCacheLife } from "@/lib/stats/cache";
import {
  NO_BATTING,
  NO_PITCHING,
  ratio,
  toBattingStats,
  toPitchingStats,
  toSlashLine,
  type BattingCounts,
  type BattingStats,
  type PitchCounts,
  type PitchingCounts,
  type PitchingStats,
  type Rate,
  type SwingDecisionCounts,
} from "@/lib/stats/rates";
import {
  BATTING_COUNTS,
  PITCH_MIX_COUNTS,
  PITCHING_COUNTS,
  TRACKED_SEASON,
  TRACKED_SEASON_GAMES,
} from "@/lib/stats/sql";

export type TeamBatting = { team: BattingStats; league: BattingStats };

export type BattingSplits = {
  vsLeft: BattingStats;
  vsRight: BattingStats;
  home: BattingStats;
  away: BattingStats;
  risp: BattingStats;
  basesEmpty: BattingStats;
};

export type TeamPitching = {
  team: PitchingStats;
  league: PitchingStats;
  starters: PitchingStats;
  bullpen: PitchingStats;
};

export type PitchMixEntry = {
  pitchType: string;
  description: string;
  pitches: number;
  usage: Rate;
  velocity: Rate;
  whiffRate: Rate;
};

export type HitterLeader = {
  playerId: number;
  name: string;
  plateAppearances: number;
  avg: Rate;
  obp: Rate;
  slg: Rate;
  ops: Rate;
  homeRuns: number;
};

export type PitcherLeader = {
  playerId: number;
  name: string;
  battersFaced: number;
  inningsPitched: number;
  strikeoutRate: Rate;
  walkRate: Rate;
  ra9: Rate;
};

export type TeamStats = {
  batting: TeamBatting;
  battingSplits: BattingSplits;
  pitching: TeamPitching;
  pitchMix: PitchMixEntry[];
  leaders: { hitters: HitterLeader[]; pitchers: PitcherLeader[] };
};

type BattingScope = "team" | "league";
type PitchingScope = "team" | "league" | "starters" | "bullpen";

type BattingRow = BattingCounts & { scope: BattingScope; split: string; teams: number };
type SwingDecisionRow = SwingDecisionCounts & { scope: BattingScope };
type PitchingRow = PitchingCounts & { scope: PitchingScope; teams: number };
type PitchRow = PitchCounts & { scope: PitchingScope };
export type PitchMixRow = { pitch_type: string; description: string; pitches: number; all_pitches: number; swings: number; whiffs: number; velocity: number | null };
type HitterRow = BattingCounts & { player_id: number; name: string };
type PitcherRow = PitchingCounts & { player_id: number; name: string };

const TEAM_AND_LEAGUE = `season = $season::INTEGER AND (scope = 'league' OR team_id = $teamId::INTEGER)`;

const BATTING_QUERY = `
  SELECT * EXCLUDE (season, team_id, games) FROM team_season_batting WHERE ${TEAM_AND_LEAGUE}`;

const SWING_DECISIONS_QUERY = `
  SELECT * EXCLUDE (season, team_id) FROM team_season_swing_decisions WHERE ${TEAM_AND_LEAGUE}`;

const PITCHING_QUERY = `
  SELECT * EXCLUDE (season, team_id) FROM team_season_pitching WHERE ${TEAM_AND_LEAGUE}`;

const PITCHES_QUERY = `
  SELECT * EXCLUDE (season, team_id) FROM team_season_pitches WHERE ${TEAM_AND_LEAGUE}`;

const PITCH_MIX_QUERY = `
  SELECT ${PITCH_MIX_COUNTS}
  FROM pitch_outcomes
  WHERE ${TRACKED_SEASON} AND fielding_team_id = $teamId::INTEGER AND pitch_type IS NOT NULL
  GROUP BY pitch_type
  ORDER BY pitches DESC`;

const HITTERS_QUERY = `
  SELECT pa.batter_id AS player_id,
    coalesce(any_value(pl.full_name), 'Player ' || pa.batter_id::VARCHAR) AS name,
    ${BATTING_COUNTS}
  FROM plate_appearances pa
  LEFT JOIN players pl ON pl.player_id = pa.batter_id
  WHERE ${TRACKED_SEASON} AND pa.batting_team_id = $teamId::INTEGER
  GROUP BY pa.batter_id
  ORDER BY plate_appearances DESC, pa.batter_id
  LIMIT 5`;

const PITCHERS_QUERY = `
  SELECT pgp.player_id,
    coalesce(any_value(pl.full_name), 'Player ' || pgp.player_id::VARCHAR) AS name,
    ${PITCHING_COUNTS}
  FROM player_game_pitching pgp
  LEFT JOIN players pl ON pl.player_id = pgp.player_id
  WHERE pgp.game_pk IN (${TRACKED_SEASON_GAMES}) AND pgp.team_id = $teamId::INTEGER
  GROUP BY pgp.player_id
  ORDER BY batters_faced DESC, pgp.player_id
  LIMIT 5`;

export function toPitchMixEntry(r: PitchMixRow): PitchMixEntry {
  return {
    pitchType: r.pitch_type,
    description: r.description,
    pitches: r.pitches,
    usage: ratio(r.pitches, r.all_pitches),
    velocity: r.velocity,
    whiffRate: ratio(r.whiffs, r.swings),
  };
}

function toHitterLeader(r: HitterRow): HitterLeader {
  return {
    playerId: r.player_id,
    name: r.name,
    plateAppearances: r.plate_appearances,
    ...toSlashLine(r),
    homeRuns: r.home_runs,
  };
}

function toPitcherLeader(r: PitcherRow): PitcherLeader {
  const { battersFaced, inningsPitched, strikeoutRate, walkRate, ra9 } = toPitchingStats({ ...NO_PITCHING, ...r });
  return { playerId: r.player_id, name: r.name, battersFaced, inningsPitched, strikeoutRate, walkRate, ra9 };
}

export async function getTeamStats(teamId: number, season: number): Promise<TeamStats> {
  "use cache: remote";
  cacheTag(teamStatsTag(teamId), seasonRollupsTag(season), ALL_STATS_TAG);
  seasonCacheLife(season, "hours");

  const params = { teamId, season };
  const [batting, swingDecisions, pitching, pitches, pitchMix, hitters, pitchers] = await Promise.all([
    readRows<BattingRow>(BATTING_QUERY, params),
    readRows<SwingDecisionRow>(SWING_DECISIONS_QUERY, params),
    readRows<PitchingRow>(PITCHING_QUERY, params),
    readRows<PitchRow>(PITCHES_QUERY, params),
    readRows<PitchMixRow>(PITCH_MIX_QUERY, params),
    readRows<HitterRow>(HITTERS_QUERY, params),
    readRows<PitcherRow>(PITCHERS_QUERY, params),
  ]);

  const seasonBatting = (scope: BattingScope) =>
    toBattingStats({
      ...NO_BATTING,
      ...batting.find((r) => r.scope === scope && r.split === "all"),
      ...swingDecisions.find((r) => r.scope === scope),
    });
  const splitBatting = (split: string) =>
    toBattingStats({ ...NO_BATTING, ...batting.find((r) => r.scope === "team" && r.split === split) });
  const pitchingFor = (scope: PitchingScope) =>
    toPitchingStats({
      ...NO_PITCHING,
      ...pitching.find((r) => r.scope === scope),
      ...pitches.find((r) => r.scope === scope),
    });

  return {
    batting: { team: seasonBatting("team"), league: seasonBatting("league") },
    battingSplits: {
      vsLeft: splitBatting("vs_L"),
      vsRight: splitBatting("vs_R"),
      home: splitBatting("home"),
      away: splitBatting("away"),
      risp: splitBatting("risp"),
      basesEmpty: splitBatting("bases_empty"),
    },
    pitching: {
      team: pitchingFor("team"),
      league: pitchingFor("league"),
      starters: pitchingFor("starters"),
      bullpen: pitchingFor("bullpen"),
    },
    pitchMix: pitchMix.map(toPitchMixEntry),
    leaders: { hitters: hitters.map(toHitterLeader), pitchers: pitchers.map(toPitcherLeader) },
  };
}
