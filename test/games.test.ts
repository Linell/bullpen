import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { getGames, toGame } = await import("@/lib/games");
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

const ATL = 144;
const PHI = 143;

type Seed = { gamePk: number; date: string; type: string; records: [home: string, away: string] };

function gameRow({ gamePk, date, type, records }: Seed) {
  return `(${gamePk}, 2026, '${date}', '${type}', 1, 'Final', 'F', 'Final', ${ATL}, ${PHI},
    '${date}T23:05:00Z', '${records[0]}', '${records[1]}', now())`;
}

beforeAll(async () => {
  const games: Seed[] = [
    { gamePk: 1, date: "2026-09-26", type: "R", records: ["92-69", "95-66"] },
    { gamePk: 2, date: "2026-09-27", type: "R", records: ["93-69", "95-67"] },
    { gamePk: 3, date: "2026-09-29", type: "F", records: ["1-0", "0-1"] },
  ];
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc,
        home_record, away_record, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
  });
});

describe("getGames", () => {
  it("shows each team's final regular-season record in the postseason", async () => {
    const [game] = await getGames("2026-09-29");

    expect([game.home.team.record, game.away.team.record]).toEqual(["93-69", "95-67"]);
  });

  it("shows the record as of a regular-season game", async () => {
    const [game] = await getGames("2026-09-26");

    expect([game.home.team.record, game.away.team.record]).toEqual(["92-69", "95-66"]);
  });
});
