import "server-only";
import { cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { STATS_TAG, teamStatsTag } from "@/lib/cache-tags";
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
  BATTER_SPLITS,
  BATTING_COUNTS,
  PITCH_COUNTS,
  PITCH_MIX_COUNTS,
  PITCHING_COUNTS,
  REGULAR_SEASON,
  REGULAR_SEASON_GAMES,
  SWING_DECISION_COUNTS,
  withNumbers,
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

const BATTING_QUERY = withNumbers(
  `WITH splits AS (
    SELECT *, ${BATTER_SPLITS} AS split
    FROM plate_appearances
    WHERE ${REGULAR_SEASON}
  )
  SELECT split,
    CASE grouping(batting_team_id) WHEN 1 THEN 'league' ELSE 'team' END AS scope,
    greatest(count(DISTINCT batting_team_id), 1) AS teams,
    ${BATTING_COUNTS}
  FROM splits
  WHERE split IS NOT NULL
  GROUP BY GROUPING SETS ((split, batting_team_id), (split))
  HAVING grouping(batting_team_id) = 1 OR batting_team_id = $teamId::INTEGER`,
  ["split", "scope"],
);

const SWING_DECISIONS_QUERY = withNumbers(
  `SELECT CASE grouping(batting_team_id) WHEN 1 THEN 'league' ELSE 'team' END AS scope,
    ${SWING_DECISION_COUNTS}
  FROM pitch_outcomes
  WHERE ${REGULAR_SEASON}
  GROUP BY GROUPING SETS ((batting_team_id), ())
  HAVING grouping(batting_team_id) = 1 OR batting_team_id = $teamId::INTEGER`,
  ["scope"],
);

const PITCHING_QUERY = withNumbers(
  `SELECT
    CASE
      WHEN grouping(team_id) = 1 THEN 'league'
      WHEN grouping(is_starter) = 1 THEN 'team'
      WHEN is_starter THEN 'starters'
      ELSE 'bullpen'
    END AS scope,
    greatest(count(DISTINCT team_id), 1) AS teams,
    ${PITCHING_COUNTS}
  FROM player_game_pitching
  WHERE game_pk IN (${REGULAR_SEASON_GAMES})
  GROUP BY GROUPING SETS ((team_id, is_starter), (team_id), ())
  HAVING grouping(team_id) = 1 OR team_id = $teamId::INTEGER`,
  ["scope"],
);

const PITCHES_QUERY = withNumbers(
  `WITH pitcher_roles AS (
    SELECT game_pk, team_id AS fielding_team_id, player_id AS pitcher_id, is_starter
    FROM player_game_pitching
  )
  SELECT
    CASE
      WHEN grouping(fielding_team_id) = 1 THEN 'league'
      WHEN grouping(is_starter) = 1 THEN 'team'
      WHEN is_starter THEN 'starters'
      WHEN NOT is_starter THEN 'bullpen'
    END AS scope,
    ${PITCH_COUNTS}
  FROM pitch_outcomes
  LEFT JOIN pitcher_roles USING (game_pk, fielding_team_id, pitcher_id)
  WHERE ${REGULAR_SEASON}
  GROUP BY GROUPING SETS ((fielding_team_id, is_starter), (fielding_team_id), ())
  HAVING grouping(fielding_team_id) = 1 OR fielding_team_id = $teamId::INTEGER`,
  ["scope"],
);

const PITCH_MIX_QUERY = withNumbers(
  `SELECT ${PITCH_MIX_COUNTS}
  FROM pitch_outcomes
  WHERE ${REGULAR_SEASON} AND fielding_team_id = $teamId::INTEGER AND pitch_type IS NOT NULL
  GROUP BY pitch_type
  ORDER BY pitches DESC`,
  ["pitch_type", "description"],
);

const HITTERS_QUERY = withNumbers(
  `SELECT pa.batter_id AS player_id,
    coalesce(any_value(pl.full_name), 'Player ' || pa.batter_id::VARCHAR) AS name,
    ${BATTING_COUNTS}
  FROM plate_appearances pa
  LEFT JOIN players pl ON pl.player_id = pa.batter_id
  WHERE ${REGULAR_SEASON} AND pa.batting_team_id = $teamId::INTEGER
  GROUP BY pa.batter_id
  ORDER BY plate_appearances DESC, pa.batter_id
  LIMIT 5`,
  ["player_id", "name"],
);

const PITCHERS_QUERY = withNumbers(
  `SELECT pgp.player_id,
    coalesce(any_value(pl.full_name), 'Player ' || pgp.player_id::VARCHAR) AS name,
    ${PITCHING_COUNTS}
  FROM player_game_pitching pgp
  LEFT JOIN players pl ON pl.player_id = pgp.player_id
  WHERE pgp.game_pk IN (${REGULAR_SEASON_GAMES}) AND pgp.team_id = $teamId::INTEGER
  GROUP BY pgp.player_id
  ORDER BY batters_faced DESC, pgp.player_id
  LIMIT 5`,
  ["player_id", "name"],
);

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
  cacheTag(teamStatsTag(teamId), STATS_TAG);
  seasonCacheLife(season);

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
