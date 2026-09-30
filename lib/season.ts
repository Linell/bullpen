import { notFound, redirect } from "next/navigation";
import { SEASON_RE } from "@/lib/team-id";

export function resolveSeason(seasons: number[], seasonParam: string[] | undefined, currentSeasonPath: string) {
  const [currentSeason] = seasons;
  if (currentSeason === undefined) notFound();
  if (!seasonParam?.length) return { season: currentSeason, isCurrentSeason: true };

  const segment = seasonParam.join("/");
  const season = Number(segment);
  if (!SEASON_RE.test(segment) || !seasons.includes(season)) notFound();
  if (season === currentSeason) redirect(currentSeasonPath);
  return { season, isCurrentSeason: false };
}
