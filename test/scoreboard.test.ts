import { describe, expect, it } from "vitest";
import { toStatus } from "@/lib/scoreboard";

const base = { abstractState: "Live", detailedState: "In Progress", inning: 6, inningHalf: "Top" };

describe("toStatus", () => {
  it("maps coded states", () => {
    expect(toStatus({ ...base, codedState: "I" })).toEqual({ state: "live", inning: "Top 6", note: undefined });
    expect(toStatus({ ...base, codedState: "I", inningHalf: "Bottom", detailedState: "Delayed: Rain" })).toEqual({
      state: "live",
      inning: "Bot 6",
      note: "Delayed",
    });
    expect(toStatus({ ...base, abstractState: "Final", codedState: "F", inning: 10 })).toEqual({ state: "final", innings: 10 });
    expect(
      toStatus({ ...base, abstractState: "Final", codedState: "Q", detailedState: "Completed Early: Forfeit" }),
    ).toEqual({ state: "final", innings: 6, note: "Forfeit" });
    expect(toStatus({ ...base, abstractState: "Final", codedState: "D" })).toEqual({ state: "postponed" });
    expect(toStatus({ ...base, codedState: "U" })).toEqual({ state: "suspended" });
    expect(toStatus({ ...base, abstractState: "Preview", codedState: "T" })).toEqual({ state: "scheduled" });
    expect(toStatus({ ...base, abstractState: "Preview", codedState: "S", inning: null })).toEqual({ state: "scheduled" });
  });
});
