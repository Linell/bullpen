import { describe, expect, it } from "vitest";
import { resolveSeason } from "@/lib/season";

const seasons = [2026, 2025, 2024];

function digestOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return (error as { digest: string }).digest;
  }
}

describe("resolveSeason", () => {
  it("defaults to the current season", () => {
    expect(resolveSeason(seasons, undefined, "/standings")).toEqual({ season: 2026, isCurrentSeason: true });
    expect(resolveSeason(seasons, [], "/standings")).toEqual({ season: 2026, isCurrentSeason: true });
  });

  it("resolves a past season", () => {
    expect(resolveSeason(seasons, ["2024"], "/standings")).toEqual({ season: 2024, isCurrentSeason: false });
  });

  it("redirects the current season to the season-less path", () => {
    expect(digestOf(() => resolveSeason(seasons, ["2026"], "/standings"))).toMatch(/^NEXT_REDIRECT;.*;\/standings;/);
  });

  it("404s on unknown or malformed seasons", () => {
    for (const param of [["2019"], ["abcd"], ["2024", "extra"], ["24"]]) {
      expect(digestOf(() => resolveSeason(seasons, param, "/standings"))).toMatch(/404/);
    }
    expect(digestOf(() => resolveSeason([], undefined, "/standings"))).toMatch(/404/);
  });
});
