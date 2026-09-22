import { describe, expect, it } from "vitest";
import { easternDate } from "@/lib/dates";

describe("easternDate", () => {
  it("uses the Eastern calendar day", () => {
    expect(easternDate(0, new Date("2026-09-22T03:30:00Z"))).toBe("2026-09-21");
  });

  it("shifts by calendar day across the fall DST change", () => {
    expect(easternDate(1, new Date("2026-11-01T04:30:00Z"))).toBe("2026-11-02");
  });

  it("shifts by calendar day across the spring DST change", () => {
    expect(easternDate(-1, new Date("2026-03-09T04:30:00Z"))).toBe("2026-03-08");
  });
});
