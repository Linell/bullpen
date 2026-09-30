export const GAMES_TAG = "games";

export const STATS_TAG = "stats";

export const BACKFILL_TAGS = [GAMES_TAG, STATS_TAG];

export function dayTag(date: string) {
  return `day:${date}`;
}

export function gameTag(gamePk: number) {
  return `game:${gamePk}`;
}

export function teamTag(teamId: number) {
  return `team:${teamId}`;
}

export function teamStatsTag(teamId: number) {
  return `team-stats:${teamId}`;
}

export function seasonRollupsTag(season: number) {
  return `season-rollups:${season}`;
}

export function playerStatsTag(playerId: number) {
  return `player-stats:${playerId}`;
}
