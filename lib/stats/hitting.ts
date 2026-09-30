import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { playerStatsTag, STATS_TAG } from "@/lib/cache-tags";
import { seasonCacheLife } from "@/lib/stats/cache";
import {
  NO_BATTING,
  toBattingStats,
  type BattingCounts,
  type BattingStats,
  type SwingDecisionCounts,
} from "@/lib/stats/rates";
import {
  BATTED_BALL_COUNTS,
  BATTER_SPLITS,
  BATTING_COUNTS,
  BOX_BATTING_COUNTS,
  TRACKED_GAME,
  TRACKED_GAMES,
  TRACKED_SEASON,
  TRACKED_SEASON_GAMES,
  SWING_DECISION_COUNTS,
} from "@/lib/stats/sql";
import type { BattingSplits } from "@/lib/stats/team";

export type HitterGameLogEntry = {
  gamePk: number;
  date: string;
  isHome: boolean;
  opponentId: number;
  opponent: string | null;
  plateAppearances: number;
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
};

export type HitterYear = { season: number; stats: BattingStats };

export type BattedBall = { x: number; y: number; bases: number };

type BattedBallCounts = Pick<BattingCounts, "batted_balls" | "hard_hits" | "exit_velocity">;
type BoxBattingCounts = Omit<BattingCounts, keyof BattedBallCounts>;

type BoxRow = BoxBattingCounts & { season: number };
type BattedBallRow = BattedBallCounts & { season: number };
type SwingDecisionRow = SwingDecisionCounts & { season: number };
type SplitRow = BattingCounts & { split: string };

const SEASON_BOX_QUERY = `
  SELECT season, ${BOX_BATTING_COUNTS}
  FROM player_game_batting
  WHERE player_id = $playerId::INTEGER AND game_pk IN (${TRACKED_SEASON_GAMES})
  GROUP BY season`;

const SEASON_BATTED_BALLS_QUERY = `
  SELECT season, ${BATTED_BALL_COUNTS}
  FROM plate_appearances
  WHERE ${TRACKED_SEASON} AND batter_id = $playerId::INTEGER
  GROUP BY season`;

const SEASON_SWING_DECISIONS_QUERY = `
  SELECT season, ${SWING_DECISION_COUNTS}
  FROM pitch_outcomes
  WHERE ${TRACKED_SEASON} AND batter_id = $playerId::INTEGER
  GROUP BY season`;

const SPLITS_QUERY = `
  SELECT split, ${BATTING_COUNTS}
  FROM (
    SELECT *, ${BATTER_SPLITS} AS split
    FROM plate_appearances
    WHERE ${TRACKED_SEASON} AND batter_id = $playerId::INTEGER
  )
  WHERE split IS NOT NULL
  GROUP BY split`;

const SPRAY_CHART_QUERY = `
  SELECT hit_coord_x AS x, hit_coord_y AS y, bases
  FROM plate_appearances
  WHERE ${TRACKED_SEASON} AND batter_id = $playerId::INTEGER AND hit_coord_x IS NOT NULL AND hit_coord_y IS NOT NULL
  ORDER BY bases, game_pk, at_bat_index`;

const GAME_LOG_QUERY = `
  SELECT b.game_pk AS "gamePk",
    strftime(g.official_date, '%Y-%m-%d') AS date,
    b.team_id = g.home_team_id AS "isHome",
    CASE b.team_id WHEN g.home_team_id THEN g.away_team_id ELSE g.home_team_id END AS "opponentId",
    opponent.abbreviation AS opponent,
    b.plate_appearances AS "plateAppearances",
    b.at_bats AS "atBats",
    b.runs,
    b.hits,
    b.doubles,
    b.triples,
    b.home_runs AS "homeRuns",
    b.rbi,
    b.walks,
    b.strikeouts,
    b.stolen_bases AS "stolenBases"
  FROM player_game_batting b
  JOIN games g USING (game_pk)
  LEFT JOIN game_teams opponent ON opponent.game_pk = b.game_pk AND opponent.team_id <> b.team_id
  WHERE b.player_id = $playerId::INTEGER AND b.game_pk IN (${TRACKED_SEASON_GAMES})
  ORDER BY g.official_date, g.game_number`;

const YEARS_BOX_QUERY = `
  SELECT season, ${BOX_BATTING_COUNTS}
  FROM player_game_batting
  WHERE player_id = $playerId::INTEGER AND game_pk IN (${TRACKED_GAMES})
  GROUP BY season
  HAVING sum(plate_appearances) > 0
  ORDER BY season`;

const YEARS_BATTED_BALLS_QUERY = `
  SELECT season, ${BATTED_BALL_COUNTS}
  FROM plate_appearances
  WHERE ${TRACKED_GAME} AND batter_id = $playerId::INTEGER
  GROUP BY season`;

const YEARS_SWING_DECISIONS_QUERY = `
  SELECT season, ${SWING_DECISION_COUNTS}
  FROM pitch_outcomes
  WHERE ${TRACKED_GAME} AND batter_id = $playerId::INTEGER
  GROUP BY season`;

export async function hitterSeason(playerId: number, season: number): Promise<BattingStats> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  const params = { playerId, season };
  const [[box], [battedBalls], [swingDecisions]] = await Promise.all([
    readRows<BoxRow>(SEASON_BOX_QUERY, params),
    readRows<BattedBallRow>(SEASON_BATTED_BALLS_QUERY, params),
    readRows<SwingDecisionRow>(SEASON_SWING_DECISIONS_QUERY, params),
  ]);

  return toBattingStats({ ...NO_BATTING, ...box, ...battedBalls, ...swingDecisions });
}

export async function hitterSplits(playerId: number, season: number): Promise<BattingSplits> {
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
    risp: splitBatting("risp"),
    basesEmpty: splitBatting("bases_empty"),
  };
}

export async function hitterGameLog(playerId: number, season: number): Promise<HitterGameLogEntry[]> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  return readRows<HitterGameLogEntry>(GAME_LOG_QUERY, { playerId, season });
}

export async function hitterSprayChart(playerId: number, season: number): Promise<BattedBall[]> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  return readRows<BattedBall>(SPRAY_CHART_QUERY, { playerId, season });
}

export async function hitterYears(playerId: number): Promise<HitterYear[]> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  cacheLife("hours");

  const params = { playerId };
  const [box, battedBalls, swingDecisions] = await Promise.all([
    readRows<BoxRow>(YEARS_BOX_QUERY, params),
    readRows<BattedBallRow>(YEARS_BATTED_BALLS_QUERY, params),
    readRows<SwingDecisionRow>(YEARS_SWING_DECISIONS_QUERY, params),
  ]);

  return box.map((line) => ({
    season: line.season,
    stats: toBattingStats({
      ...NO_BATTING,
      ...line,
      ...battedBalls.find((b) => b.season === line.season),
      ...swingDecisions.find((s) => s.season === line.season),
    }),
  }));
}
