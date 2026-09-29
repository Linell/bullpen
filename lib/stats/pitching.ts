import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { playerStatsTag, STATS_TAG } from "@/lib/cache-tags";
import { seasonCacheLife } from "@/lib/stats/cache";
import {
  NO_BATTING,
  NO_PITCHING,
  toBattingStats,
  toPitchingStats,
  type BattingCounts,
  type BattingStats,
  type PitchCounts,
  type PitchingCounts,
  type PitchingStats,
  type Rate,
} from "@/lib/stats/rates";
import {
  BATTING_COUNTS,
  PITCH_COUNTS,
  PITCH_MIX_COUNTS,
  PITCHING_COUNTS,
  TRACKED_GAME,
  TRACKED_GAMES,
  TRACKED_SEASON,
  TRACKED_SEASON_GAMES,
  withNumbers,
} from "@/lib/stats/sql";
import { toPitchMixEntry, type PitchMixEntry, type PitchMixRow } from "@/lib/stats/team";

export type PitcherSplits = {
  vsLeft: BattingStats;
  vsRight: BattingStats;
  home: BattingStats;
  away: BattingStats;
};

export type PitcherDecision = "W" | "L" | "S" | "H" | "BS";

export type PitcherGameLogEntry = {
  gamePk: number;
  date: string;
  isHome: boolean;
  opponentId: number;
  opponent: string | null;
  isStarter: boolean;
  decisions: PitcherDecision[];
  inningsPitched: number;
  battersFaced: number;
  pitches: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
};

export type PitcherYear = { season: number; stats: PitchingStats };

export type ArsenalEntry = PitchMixEntry & { spinRate: Rate };

type BoxRow = PitchingCounts & { season: number };
type PitchRow = PitchCounts & { season: number };
type SplitRow = BattingCounts & { split: string };
type ArsenalRow = PitchMixRow & { spin_rate: number | null };

const SEASON_BOX_QUERY = withNumbers(
  `SELECT season, ${PITCHING_COUNTS}
  FROM player_game_pitching
  WHERE player_id = $playerId::INTEGER AND game_pk IN (${TRACKED_SEASON_GAMES})
  GROUP BY season`,
  ["season"],
);

const SEASON_PITCHES_QUERY = withNumbers(
  `SELECT season, ${PITCH_COUNTS}
  FROM pitch_outcomes
  WHERE ${TRACKED_SEASON} AND pitcher_id = $playerId::INTEGER
  GROUP BY season`,
  ["season"],
);

const SPLITS_QUERY = withNumbers(
  `SELECT split, ${BATTING_COUNTS}
  FROM (
    SELECT *, unnest([
      'vs_' || bat_side::VARCHAR,
      CASE half WHEN 'top' THEN 'home' ELSE 'away' END
    ]) AS split
    FROM plate_appearances
    WHERE ${TRACKED_SEASON} AND pitcher_id = $playerId::INTEGER
  )
  WHERE split IS NOT NULL
  GROUP BY split`,
  ["split"],
);

const GAME_LOG_QUERY = `
  SELECT p.game_pk AS "gamePk",
    strftime(g.official_date, '%Y-%m-%d') AS date,
    p.team_id = g.home_team_id AS "isHome",
    CASE p.team_id WHEN g.home_team_id THEN g.away_team_id ELSE g.home_team_id END AS "opponentId",
    opponent.abbreviation AS opponent,
    p.is_starter AS "isStarter",
    list_filter([
      CASE WHEN p.is_win THEN 'W' END,
      CASE WHEN p.is_loss THEN 'L' END,
      CASE WHEN p.is_save THEN 'S' END,
      CASE WHEN p.is_hold THEN 'H' END,
      CASE WHEN p.is_blown_save THEN 'BS' END
    ], lambda d: d IS NOT NULL) AS decisions,
    p.outs / 3 AS "inningsPitched",
    p.batters_faced AS "battersFaced",
    p.pitches,
    p.hits,
    p.runs,
    p.earned_runs AS "earnedRuns",
    p.walks,
    p.strikeouts,
    p.home_runs AS "homeRuns"
  FROM player_game_pitching p
  JOIN games g USING (game_pk)
  LEFT JOIN game_teams opponent ON opponent.game_pk = p.game_pk AND opponent.team_id <> p.team_id
  WHERE p.player_id = $playerId::INTEGER AND p.game_pk IN (${TRACKED_SEASON_GAMES})
  ORDER BY g.official_date, g.game_number`;

const YEARS_BOX_QUERY = withNumbers(
  `SELECT season, ${PITCHING_COUNTS}
  FROM player_game_pitching
  WHERE player_id = $playerId::INTEGER AND game_pk IN (${TRACKED_GAMES})
  GROUP BY season
  ORDER BY season`,
  ["season"],
);

const YEARS_PITCHES_QUERY = withNumbers(
  `SELECT season, ${PITCH_COUNTS}
  FROM pitch_outcomes
  WHERE ${TRACKED_GAME} AND pitcher_id = $playerId::INTEGER
  GROUP BY season`,
  ["season"],
);

const ARSENAL_QUERY = withNumbers(
  `SELECT ${PITCH_MIX_COUNTS},
    avg(spin_rate) AS spin_rate
  FROM pitch_outcomes
  WHERE ${TRACKED_SEASON} AND pitcher_id = $playerId::INTEGER AND pitch_type IS NOT NULL
  GROUP BY pitch_type
  ORDER BY pitches DESC`,
  ["pitch_type", "description"],
);

export async function pitcherSeason(playerId: number, season: number): Promise<PitchingStats> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  const params = { playerId, season };
  const [[box], [pitches]] = await Promise.all([
    readRows<BoxRow>(SEASON_BOX_QUERY, params),
    readRows<PitchRow>(SEASON_PITCHES_QUERY, params),
  ]);

  return toPitchingStats({ ...NO_PITCHING, ...box, ...pitches });
}

export async function pitcherSplits(playerId: number, season: number): Promise<PitcherSplits> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  const rows = await readRows<SplitRow>(SPLITS_QUERY, { playerId, season });
  const splitBatting = (split: string) => toBattingStats({ ...NO_BATTING, ...rows.find((r) => r.split === split) });

  return {
    vsLeft: splitBatting("vs_L"),
    vsRight: splitBatting("vs_R"),
    home: splitBatting("home"),
    away: splitBatting("away"),
  };
}

export async function pitcherGameLog(playerId: number, season: number): Promise<PitcherGameLogEntry[]> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  return readRows<PitcherGameLogEntry>(GAME_LOG_QUERY, { playerId, season });
}

export async function pitcherYears(playerId: number): Promise<PitcherYear[]> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  cacheLife("hours");

  const params = { playerId };
  const [box, pitches] = await Promise.all([
    readRows<BoxRow>(YEARS_BOX_QUERY, params),
    readRows<PitchRow>(YEARS_PITCHES_QUERY, params),
  ]);

  return box.map((line) => ({
    season: line.season,
    stats: toPitchingStats({ ...NO_PITCHING, ...line, ...pitches.find((p) => p.season === line.season) }),
  }));
}

export async function pitcherArsenal(playerId: number, season: number): Promise<ArsenalEntry[]> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  const rows = await readRows<ArsenalRow>(ARSENAL_QUERY, { playerId, season });
  return rows.map((r) => ({ ...toPitchMixEntry(r), spinRate: r.spin_rate }));
}
