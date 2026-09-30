import "server-only";
import { notFound } from "next/navigation";
import { PLAYER_ID_RE } from "@/lib/player-id";
import { playerPath, type PlayerRole } from "@/lib/routes";
import { resolveSeason } from "@/lib/season";
import { playerSummary, type PlayerSummary } from "@/lib/stats/player";
import { getTeamSeasons } from "@/lib/team-summary";

export type LoadedPlayerSeason = {
  summary: PlayerSummary;
  role: PlayerRole;
  seasons: number[];
  season: number;
  isLatestSeason: boolean;
};

const ROLE_LABELS: Record<PlayerRole, string> = { hitting: "Hitting", pitching: "Pitching" };

export async function loadPlayer(playerIdParam: string): Promise<PlayerSummary> {
  if (!PLAYER_ID_RE.test(playerIdParam)) notFound();
  const summary = await playerSummary(Number(playerIdParam));
  if (!summary) notFound();
  return summary;
}

export async function loadPlayerSeason(
  playerIdParam: string,
  role: PlayerRole,
  seasonParam?: string[],
): Promise<LoadedPlayerSeason> {
  const summary = await loadPlayer(playerIdParam);
  const seasons = roleSeasons(summary, role).toReversed();
  const { season, isCurrentSeason } = resolveSeason(seasons, seasonParam, playerPath(summary.playerId, { role }));
  return { summary, role, seasons, season, isLatestSeason: isCurrentSeason };
}

function roleSeasons(summary: PlayerSummary, role: PlayerRole) {
  return role === "hitting" ? summary.battingSeasons : summary.pitchingSeasons;
}

export function primaryRole(summary: PlayerSummary): PlayerRole {
  const isPitcher = summary.latest?.position === "P";
  return isPitcher || summary.battingSeasons.length === 0 ? "pitching" : "hitting";
}

export async function teamLinkSeason(summary: PlayerSummary) {
  const seasons = [...summary.battingSeasons, ...summary.pitchingSeasons];
  if (!summary.latest || seasons.length === 0) return undefined;

  const playerSeason = Math.max(...seasons);
  const [teamSeason] = await getTeamSeasons(summary.latest.teamId);
  return playerSeason === teamSeason ? undefined : playerSeason;
}

export function playerTitle({ summary, role, season, isLatestSeason }: LoadedPlayerSeason) {
  const roleLabel = ROLE_LABELS[role];
  return isLatestSeason ? `${summary.fullName} ${roleLabel}` : `${summary.fullName} ${season} ${roleLabel}`;
}
