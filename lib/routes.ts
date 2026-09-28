export type PlayerRole = "hitting" | "pitching";

export function teamPath(teamId: number, season?: number) {
  return season === undefined ? `/teams/${teamId}` : `/teams/${teamId}/${season}`;
}

export function gamePath(gamePk: number) {
  return `/games/${gamePk}`;
}

export function playerPath(playerId: number, { role, season }: { role?: PlayerRole; season?: number } = {}) {
  if (!role) return `/players/${playerId}`;
  return season === undefined ? `/players/${playerId}/${role}` : `/players/${playerId}/${role}/${season}`;
}
