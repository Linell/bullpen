import { describe, expect, it } from "vitest";
import { toLinescore, type LinescoreRow } from "@/lib/linescore";

function line(inning: number, half: "top" | "bottom", runs: number | null): LinescoreRow {
  return { inning, half, runs, hits: runs ?? 0, errors: 0 };
}

const nineInnings = Array.from({ length: 9 }, (_, i) => i + 1);

describe("toLinescore", () => {
  it("marks an unplayed half with x in a completed game", () => {
    const rows = [...nineInnings.map((i) => line(i, "top", 0)), ...nineInnings.map((i) => line(i, "bottom", i === 9 ? null : 1))];
    const { away, home } = toLinescore(rows, true);
    expect(away.innings).toEqual(Array(9).fill("0"));
    expect(home.innings.at(-1)).toBe("x");
    expect(home.runs).toBe(8);
  });

  it("leaves missing data blank", () => {
    const rows = [line(1, "top", 2), line(1, "bottom", null)];
    const { innings, away, home } = toLinescore(rows, false);
    expect(innings).toEqual(nineInnings);
    expect(away.innings).toEqual(["2", "", "", "", "", "", "", "", ""]);
    expect(home.innings[0]).toBe("");
    expect(toLinescore([line(1, "top", 2)], true).home.innings[0]).toBe("");
  });

  it("extends past nine for extra innings", () => {
    const { innings, away } = toLinescore([line(11, "top", 1)], true);
    expect(innings).toHaveLength(11);
    expect(away.innings[10]).toBe("1");
  });
});
