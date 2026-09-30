import { DEFAULT_SEARCH, type LeaderboardSearch } from "@/lib/leaderboard-range";

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

export function leadersPath({ range, limit }: Partial<LeaderboardSearch> = {}) {
  const query = new URLSearchParams();
  if (range && range !== DEFAULT_SEARCH.range) query.set("range", range);
  if (limit && limit !== DEFAULT_SEARCH.limit) query.set("limit", String(limit));
  const search = query.toString();
  return search ? `/leaders?${search}` : "/leaders";
}

export function scoresPath(date: string) {
  return `/scores/${date}`;
}

export function standingsPath(season?: number) {
  return season === undefined ? "/standings" : `/standings/${season}`;
}
