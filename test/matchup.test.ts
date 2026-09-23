import { describe, expect, it } from "vitest";
import { seriesRecord, streak, type TeamResult } from "@/lib/matchup";

function result(won: boolean): TeamResult {
  return {
    gamePk: 1,
    officialDate: "2026-09-20",
    won,
    home: true,
    opponent: "NYY",
    runsFor: 0,
    runsAgainst: 0,
  };
}

describe("streak", () => {
  it("counts the latest run of results", () => {
    expect(streak([])).toBeUndefined();
    expect(streak([result(true), result(true), result(false)])).toBe("W2");
    expect(streak([result(false), result(false)])).toBe("L2");
  });
});

describe("seriesRecord", () => {
  it("counts wins from the away team's side", () => {
    expect(seriesRecord([result(true), result(false), result(true)])).toEqual({
      awayWins: 2,
      homeWins: 1,
    });
  });
});
