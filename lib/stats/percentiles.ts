import "server-only";
import { cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { seasonTablesTag, ALL_STATS_TAG } from "@/lib/cache-tags";
import { seasonCacheLife } from "@/lib/stats/cache";

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
  role: "batter" | "pitcher",
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
  WITH qualifier AS (
    SELECT coalesce(ceil(${perTeamGame} * max(games)), 0)::INTEGER AS threshold
    FROM team_season_batting
    WHERE season = $season::INTEGER AND scope = 'team' AND split = 'all'
  ),
  qualified AS (
    SELECT player_id, ${values.join(", ")}
    FROM player_season_counts
    WHERE season = $season::INTEGER AND role = '${role}' AND plate_appearances >= (SELECT threshold FROM qualifier)
  ),
  ranked AS (
    SELECT player_id, ${percentiles.join(", ")}
    FROM qualified
  )
  SELECT threshold, ranked.player_id IS NOT NULL AS qualified, ranked.* EXCLUDE (player_id)
  FROM qualifier
  LEFT JOIN ranked ON ranked.player_id = $playerId::INTEGER`;
}

const HITTING_QUERY = percentileQuery("batter", PA_PER_TEAM_GAME, HITTING_STATS);
const PITCHING_QUERY = percentileQuery("pitcher", BF_PER_TEAM_GAME, PITCHING_STATS);

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
  cacheTag(seasonTablesTag(season), ALL_STATS_TAG);
  seasonCacheLife(season, "hours");

  return percentileBoard<HittingPercentiles>(HITTING_QUERY, playerId, season);
}

export async function pitchingPercentiles(playerId: number, season: number) {
  "use cache: remote";
  cacheTag(seasonTablesTag(season), ALL_STATS_TAG);
  seasonCacheLife(season, "hours");

  return percentileBoard<PitchingPercentiles>(PITCHING_QUERY, playerId, season);
}
