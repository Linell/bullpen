import { describe, expect, it } from "vitest";
import type { ScoreUpdate } from "@/lib/inngest/realtime";
import { mergeUpdates, toStatus, type Game } from "@/lib/scoreboard";

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
    expect(toStatus({ ...base, abstractState: "Final", codedState: "D" })).toEqual({ state: "postponed" });
    expect(toStatus({ ...base, codedState: "U" })).toEqual({ state: "suspended" });
    expect(toStatus({ ...base, abstractState: "Preview", codedState: "T" })).toEqual({ state: "scheduled" });
    expect(toStatus({ ...base, abstractState: "Preview", codedState: "S", inning: null })).toEqual({ state: "scheduled" });
  });
});

describe("mergeUpdates", () => {
  const game: Game = {
    id: "1",
    gamePk: 1,
    officialDate: "2026-09-22",
    gameNumber: 1,
    startTime: "2026-09-22T23:05:00.000Z",
    status: { state: "scheduled" },
    away: { team: { name: "A", abbreviation: "A" } },
    home: { team: { name: "H", abbreviation: "H" } },
    updatedAt: 1_000,
  };
  const update: ScoreUpdate = {
    gamePk: 1,
    officialDate: "2026-09-22",
    abstractState: "Live",
    codedState: "I",
    detailedState: "In Progress",
    homeScore: 2,
    awayScore: 1,
    inning: 3,
    inningHalf: "Bottom",
  };

  it("applies newer updates for the same date", () => {
    const [merged] = mergeUpdates([game], [{ topic: "games", data: [update], createdAt: new Date(2_000) }], "2026-09-22");
    expect(merged.status).toEqual({ state: "live", inning: "Bot 3", note: undefined });
    expect(merged.home.score).toBe(2);
  });

  it("ignores stale updates and other dates", () => {
    const stale = mergeUpdates([game], [{ topic: "games", data: [update], createdAt: new Date(500) }], "2026-09-22");
    const other = mergeUpdates(
      [game],
      [{ topic: "games", data: [{ ...update, officialDate: "2026-09-21" }], createdAt: new Date(2_000) }],
      "2026-09-22",
    );
    expect(stale[0]).toBe(game);
    expect(other[0]).toBe(game);
  });
});
