import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const { toGame } = await import("@/lib/games");
type GameQueryRow = import("@/lib/games").GameQueryRow;

const row: GameQueryRow = {
  game_pk: 849841,
  season: 2026,
  official_date: "2026-09-30",
  game_type: "F",
  game_number: 1,
  double_header: "N",
  rescheduled_from: null,
  abstract_state: "Preview",
  coded_state: "S",
  detailed_state: "Scheduled",
  home_team_id: 144,
  away_team_id: 143,
  home_score: null,
  away_score: null,
  inning: null,
  inning_half: null,
  outs: null,
  on_first: false,
  on_second: false,
  on_third: false,
  start_ms: Date.parse("2026-09-30T23:08:00Z"),
  venue_name: "Truist Park",
  home_record: "1-0",
  away_record: "0-1",
  home_probable_id: null,
  home_probable_name: null,
  away_probable_id: null,
  away_probable_name: null,
  series_game_number: 2,
  games_in_series: 3,
  series_result: "ATL leads 1-0",
  home_name: "Braves",
  home_abbr: "ATL",
  away_name: "Phillies",
  away_abbr: "PHI",
};

describe("toGame", () => {
  it("carries the series status of a postseason game", () => {
    expect(toGame(row).series).toEqual({ gameNumber: 2, games: 3, result: "ATL leads 1-0" });
  });

  it("leaves out the series of a regular-season game", () => {
    expect(toGame({ ...row, game_type: "R" }).series).toBeUndefined();
  });
});
