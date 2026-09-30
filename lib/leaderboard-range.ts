import { shiftDate } from "./dates.ts";

export const RANGES = { today: "Today", week: "7 days", month: "30 days", season: "Season" } as const;

export type RangeKey = keyof typeof RANGES;

export const RANGE_KEYS = Object.keys(RANGES) as RangeKey[];

export const LIMITS = [10, 25, 50] as const;

export type Limit = (typeof LIMITS)[number];

export type LeaderboardSearch = { range: RangeKey; limit: Limit };

export const DEFAULT_SEARCH: LeaderboardSearch = { range: "today", limit: 25 };

type SearchParams = Record<string, string | string[] | undefined>;

function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && Object.hasOwn(RANGES, value);
}

export function parseLeaderboardSearch(params: SearchParams): LeaderboardSearch {
  const range = isRangeKey(params.range) ? params.range : DEFAULT_SEARCH.range;
  const limit = LIMITS.find((n) => String(n) === params.limit) ?? DEFAULT_SEARCH.limit;
  return { range, limit };
}

export function rangeDates(range: RangeKey, today: string) {
  switch (range) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: shiftDate(today, -6), to: today };
    case "month":
      return { from: shiftDate(today, -29), to: today };
    case "season":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}
