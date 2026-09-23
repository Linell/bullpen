import { describe, expect, it } from "vitest";
import { toStatus } from "@/lib/scoreboard";

const base = {
  abstractState: "Live",
  detailedState: "In Progress",
  inning: 6,
  inningHalf: "Top",
  outs: null,
  bases: [false, false, false] as [boolean, boolean, boolean],
};

describe("toStatus", () => {
  it("maps coded states", () => {
    expect(toStatus({ ...base, codedState: "I" })).toEqual({ state: "live", inning: "Top 6" });
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

  it("carries outs and runners for a live game", () => {
    const status = toStatus({ ...base, codedState: "I", outs: 2, bases: [true, false, true] });
    expect(status).toMatchObject({ situation: { outs: 2, bases: [true, false, true] } });
  });

  it("drops the situation between half-innings", () => {
    expect(toStatus({ ...base, codedState: "I", outs: 3 })).toMatchObject({ situation: undefined });
  });
});
