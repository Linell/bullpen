import { describe, expect, it } from "vitest";
import { shiftDate, todayOfficialDate } from "@/lib/dates";

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
