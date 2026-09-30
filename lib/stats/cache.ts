import { cacheLife } from "next/cache";
import { todayOfficialDate } from "@/lib/dates";

export function isPastSeason(season: number) {
  return season < Number(todayOfficialDate().slice(0, 4));
}

export function seasonCacheLife(season: number, currentSeasonLife: "hours" | "live") {
  if (isPastSeason(season)) cacheLife("max");
  else if (currentSeasonLife === "live") cacheLife("live");
  else cacheLife("hours");
}
