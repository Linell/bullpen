import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { playerStatsTag, ALL_STATS_TAG } from "@/lib/cache-tags";
import { TRACKED_GAMES } from "@/lib/stats/sql";

export type PlayerBio = {
  playerId: number;
  fullName: string;
  batSide: string | null;
  pitchHand: string | null;
  birthDate: string | null;
  height: string | null;
  weight: number | null;
  mlbDebutDate: string | null;
  active: boolean | null;
};

export type PlayerRole = {
  teamId: number;
  teamName: string | null;
  jerseyNumber: string | null;
  position: string | null;
};

export type PlayerSummary = PlayerBio & {
  latest: PlayerRole | null;
  battingSeasons: number[];
  pitchingSeasons: number[];
};

type SeasonRow = { season: number };

const BIO_QUERY = `
  SELECT player_id AS "playerId",
    full_name AS "fullName",
    bat_side::VARCHAR AS "batSide",
    pitch_hand::VARCHAR AS "pitchHand",
    strftime(birth_date, '%Y-%m-%d') AS "birthDate",
    height,
    weight,
    strftime(mlb_debut_date, '%Y-%m-%d') AS "mlbDebutDate",
    active
  FROM players
  WHERE player_id = $playerId::INTEGER`;

const LATEST_ROLE_QUERY = `
  SELECT gp.team_id AS "teamId",
    team.name AS "teamName",
    gp.jersey_number AS "jerseyNumber",
    gp.position
  FROM game_players gp
  JOIN games g USING (game_pk)
  LEFT JOIN game_teams team ON team.game_pk = gp.game_pk AND team.team_id = gp.team_id
  WHERE gp.player_id = $playerId::INTEGER AND gp.played AND gp.game_pk IN (${TRACKED_GAMES})
  ORDER BY g.official_date DESC, g.game_number DESC
  LIMIT 1`;

const BATTING_SEASONS_QUERY = `
  SELECT season
  FROM player_game_batting
  WHERE player_id = $playerId::INTEGER AND game_pk IN (${TRACKED_GAMES})
  GROUP BY season
  HAVING sum(plate_appearances) > 0
  ORDER BY season`;

const PITCHING_SEASONS_QUERY = `
  SELECT DISTINCT season
  FROM player_game_pitching
  WHERE player_id = $playerId::INTEGER AND game_pk IN (${TRACKED_GAMES})
  ORDER BY season`;

export async function playerSummary(playerId: number): Promise<PlayerSummary | null> {
  "use cache: remote";
  cacheTag(playerStatsTag(playerId), ALL_STATS_TAG);
  cacheLife("hours");

  const params = { playerId };
  const [[bio], [latest], battingSeasons, pitchingSeasons] = await Promise.all([
    readRows<PlayerBio>(BIO_QUERY, params),
    readRows<PlayerRole>(LATEST_ROLE_QUERY, params),
    readRows<SeasonRow>(BATTING_SEASONS_QUERY, params),
    readRows<SeasonRow>(PITCHING_SEASONS_QUERY, params),
  ]);
  if (!bio) return null;

  return {
    ...bio,
    latest: latest ?? null,
    battingSeasons: battingSeasons.map((r) => r.season),
    pitchingSeasons: pitchingSeasons.map((r) => r.season),
  };
}
