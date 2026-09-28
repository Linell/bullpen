import { cacheLife } from "next/cache";
import { todayOfficialDate } from "@/lib/dates";

function isPastSeason(season: number) {
  return season < Number(todayOfficialDate().slice(0, 4));
}

export function seasonCacheLife(season: number) {
  if (isPastSeason(season)) cacheLife("max");
  else cacheLife("hours");
}
