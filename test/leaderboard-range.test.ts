import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH, parseLeaderboardSearch, rangeDates } from "@/lib/leaderboard-range";

describe("parseLeaderboardSearch", () => {
  it("defaults to today and 25 leaders", () => {
    expect(parseLeaderboardSearch({})).toEqual(DEFAULT_SEARCH);
    expect(DEFAULT_SEARCH).toEqual({ range: "today", limit: 25 });
  });

  it("accepts whitelisted ranges and limits", () => {
    expect(parseLeaderboardSearch({ range: "month", limit: "50" })).toEqual({ range: "month", limit: 50 });
  });

  it("falls back on unknown, inherited, or repeated values", () => {
    expect(parseLeaderboardSearch({ range: "decade", limit: "7" })).toEqual(DEFAULT_SEARCH);
    expect(parseLeaderboardSearch({ range: "constructor" })).toEqual(DEFAULT_SEARCH);
    expect(parseLeaderboardSearch({ range: ["week", "month"], limit: ["10", "50"] })).toEqual(DEFAULT_SEARCH);
  });
});

describe("rangeDates", () => {
  it("covers today alone", () => {
    expect(rangeDates("today", "2026-09-28")).toEqual({ from: "2026-09-28", to: "2026-09-28" });
  });

  it("covers the last 7 and 30 days inclusive", () => {
    expect(rangeDates("week", "2026-09-28")).toEqual({ from: "2026-09-22", to: "2026-09-28" });
    expect(rangeDates("month", "2026-09-28")).toEqual({ from: "2026-08-30", to: "2026-09-28" });
  });

  it("starts the season on January 1", () => {
    expect(rangeDates("season", "2026-09-28")).toEqual({ from: "2026-01-01", to: "2026-09-28" });
  });
});
