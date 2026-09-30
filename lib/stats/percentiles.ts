import "server-only";
import { cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { playerStatsTag, STATS_TAG } from "@/lib/cache-tags";
import { seasonCacheLife } from "@/lib/stats/cache";
import { BATTING_COUNTS, PITCH_COUNTS, SWING_DECISION_COUNTS, TRACKED_SEASON } from "@/lib/stats/sql";

export const PA_PER_TEAM_GAME = 2.1;
export const BF_PER_TEAM_GAME = 1.25;

export type Percentile = { value: number; percentile: number };

type Better = "higher" | "lower";

const HITTING_STATS = {
  exitVelocity: { value: "exit_velocity", better: "higher" },
  hardHitRate: { value: "hard_hits / batted_balls", better: "higher" },
  barrelRate: { value: "barrels / batted_balls", better: "higher" },
  strikeoutRate: { value: "strikeouts / plate_appearances", better: "lower" },
  walkRate: { value: "walks / plate_appearances", better: "higher" },
  whiffRate: { value: "whiffs / swings", better: "lower" },
  chaseRate: { value: "chases / out_of_zone_pitches", better: "lower" },
  ops: {
    value: "(hits + walks + hit_by_pitch) / (at_bats + walks + hit_by_pitch + sac_flies) + total_bases / at_bats",
    better: "higher",
  },
} satisfies Record<string, { value: string; better: Better }>;

const PITCHING_STATS = {
  fastballVelocity: { value: "fastball_velocity", better: "higher" },
  strikeoutRate: { value: "strikeouts / plate_appearances", better: "higher" },
  walkRate: { value: "walks / plate_appearances", better: "lower" },
  whiffRate: { value: "whiffs / swings", better: "higher" },
  chaseRate: { value: "chases / out_of_zone_pitches", better: "higher" },
  cswRate: { value: "(called_strikes + whiffs) / pitches", better: "higher" },
  hardHitRate: { value: "hard_hits / batted_balls", better: "lower" },
  barrelRate: { value: "barrels / batted_balls", better: "lower" },
} satisfies Record<string, { value: string; better: Better }>;

export type HittingPercentiles = Record<keyof typeof HITTING_STATS, Percentile | null>;
export type PitchingPercentiles = Record<keyof typeof PITCHING_STATS, Percentile | null>;

export type PercentileBoard<T> = { threshold: number; percentiles?: T };

function percentileQuery(
  player: "batter_id" | "pitcher_id",
  perTeamGame: number,
  stats: Record<string, { value: string; better: Better }>,
) {
  const entries = Object.entries(stats);
  const values = entries.map(([key, stat]) => `(${stat.value})::DOUBLE AS "${key}"`);
  const percentiles = entries.map(
    ([key, stat]) => `CASE WHEN "${key}" IS NOT NULL THEN struct_pack(
      value := "${key}",
      percentile := round(100 * percent_rank() OVER (
        PARTITION BY "${key}" IS NULL ORDER BY "${key}" ${stat.better === "higher" ? "ASC" : "DESC"}
      ))::INTEGER
    ) END AS "${key}"`,
  );

  return `
  WITH team_games AS (
    SELECT batting_team_id, count(DISTINCT game_pk) AS games
    FROM plate_appearances
    WHERE ${TRACKED_SEASON}
    GROUP BY batting_team_id
  ),
  qualifier AS (
    SELECT coalesce(ceil(${perTeamGame} * max(games)), 0)::INTEGER AS threshold FROM team_games
  ),
  batting AS (
    SELECT ${player} AS player_id, ${BATTING_COUNTS}
    FROM plate_appearances
    WHERE ${TRACKED_SEASON}
    GROUP BY ${player}
  ),
  pitches AS (
    SELECT ${player} AS player_id, ${PITCH_COUNTS}, ${SWING_DECISION_COUNTS}
    FROM pitch_outcomes
    WHERE ${TRACKED_SEASON}
    GROUP BY ${player}
  ),
  qualified AS (
    SELECT player_id, ${values.join(", ")}
    FROM batting
    LEFT JOIN pitches USING (player_id)
    WHERE plate_appearances >= (SELECT threshold FROM qualifier)
  ),
  ranked AS (
    SELECT player_id, ${percentiles.join(", ")}
    FROM qualified
  )
  SELECT threshold, ranked.player_id IS NOT NULL AS qualified, ranked.* EXCLUDE (player_id)
  FROM qualifier
  LEFT JOIN ranked ON ranked.player_id = $playerId::INTEGER`;
}

const HITTING_QUERY = percentileQuery("batter_id", PA_PER_TEAM_GAME, HITTING_STATS);
const PITCHING_QUERY = percentileQuery("pitcher_id", BF_PER_TEAM_GAME, PITCHING_STATS);

async function percentileBoard<T extends Record<string, Percentile | null>>(
  query: string,
  playerId: number,
  season: number,
): Promise<PercentileBoard<T>> {
  const [{ threshold, qualified, ...percentiles }] = await readRows<{ threshold: number; qualified: boolean } & T>(
    query,
    { playerId, season },
  );
  return qualified ? { threshold, percentiles: percentiles as unknown as T } : { threshold };
}

export async function hittingPercentiles(playerId: number, season: number) {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  return percentileBoard<HittingPercentiles>(HITTING_QUERY, playerId, season);
}

export async function pitchingPercentiles(playerId: number, season: number) {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), STATS_TAG);
  seasonCacheLife(season);

  return percentileBoard<PitchingPercentiles>(PITCHING_QUERY, playerId, season);
}
