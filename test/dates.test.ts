import { describe, expect, it } from "vitest";
import { clampDateRange, formatCountdown, shiftDate, todayOfficialDate } from "@/lib/dates";

describe("todayOfficialDate", () => {
  it("uses the Eastern calendar day", () => {
    expect(todayOfficialDate(new Date("2026-09-22T03:30:00Z"))).toBe("2026-09-21");
  });
});

describe("shiftDate", () => {
  it("shifts by calendar day across the fall DST change", () => {
    expect(shiftDate(todayOfficialDate(new Date("2026-11-01T04:30:00Z")), 1)).toBe("2026-11-02");
  });

  it("shifts by calendar day across the spring DST change", () => {
    expect(shiftDate(todayOfficialDate(new Date("2026-03-09T04:30:00Z")), -1)).toBe("2026-03-08");
  });
});

describe("formatCountdown", () => {
  it("formats the time until first pitch", () => {
    expect(formatCountdown(0)).toBeUndefined();
    expect(formatCountdown(30_000)).toBe("1m");
    expect(formatCountdown((2 * 60 + 14) * 60_000)).toBe("2h 14m");
    expect(formatCountdown((27 * 60 + 5) * 60_000)).toBe("1d 3h");
  });
});

describe("clampDateRange", () => {
  const season = { startDate: "2026-03-26", endDate: "2026-10-31" };

  it("keeps the season's dates when nothing is requested", () => {
    expect(clampDateRange({}, season)).toEqual(season);
  });

  it("keeps a requested range inside the season", () => {
    const slice = { startDate: "2026-06-01", endDate: "2026-06-07" };
    expect(clampDateRange(slice, season)).toEqual(slice);
  });

  it("clamps a requested range to the season", () => {
    expect(clampDateRange({ startDate: "2026-01-01", endDate: "2026-12-31" }, season)).toEqual(season);
  });
});
