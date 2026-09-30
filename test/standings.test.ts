import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { getStandings, getStandingsSeasons } = await import("@/lib/standings");

const NYY = 147;
const BAL = 110;
const TOR = 141;
const BOS = 111;
const NYM = 121;
const ATL = 144;
const AL_EAST = 201;
const NL_EAST = 204;

type Seed = {
  gamePk: number;
  date: string;
  home: number;
  away: number;
  score?: [home: number, away: number];
  type?: string;
};

function gameRow({ gamePk, date, home, away, score, type = "R" }: Seed) {
  const [state, coded] = score ? ["Final", "F"] : ["Preview", "S"];
  return `(${gamePk}, ${date.slice(0, 4)}, '${date}', '${type}', 1, '${state}', '${coded}', '${state}', ${home}, ${away},
    ${score?.[0] ?? "NULL"}, ${score?.[1] ?? "NULL"}, '${date}T23:05:00Z', now())`;
}

type TeamSeed = [season: number, id: number, name: string, abbr: string, league: string, divisionId: number, division: string];

function teamRow([season, id, name, abbr, league, divisionId, division]: TeamSeed) {
  return `(${id}, ${season}, '${name}', '${abbr}', '${league}', ${divisionId}, '${division}', ${season}, '${season}-09-20', 1)`;
}

beforeAll(async () => {
  const games: Seed[] = [
    { gamePk: 1, date: "2026-09-20", home: NYY, away: BAL, score: [5, 3] },
    { gamePk: 2, date: "2026-09-21", home: NYY, away: TOR, score: [1, 4] },
    { gamePk: 3, date: "2026-09-22", home: BAL, away: NYY, score: [2, 6] },
    { gamePk: 4, date: "2026-09-23", home: NYY, away: NYM, score: [3, 2] },
    { gamePk: 5, date: "2026-09-24", home: BOS, away: TOR, score: [7, 1] },
    { gamePk: 6, date: "2026-09-24", home: ATL, away: NYM, score: [1, 0] },
    { gamePk: 7, date: "2026-09-27", home: NYY, away: BAL },
    { gamePk: 8, date: "2026-09-25", home: NYY, away: BOS, score: [9, 0], type: "F" },
    { gamePk: 9, date: "2025-09-20", home: NYY, away: BAL, score: [0, 1] },
  ];
  const teams: TeamSeed[] = [
    [2026, NYY, "New York Yankees", "NYY", "American League", AL_EAST, "AL East"],
    [2026, BAL, "Baltimore Orioles", "BAL", "American League", AL_EAST, "AL East"],
    [2026, TOR, "Toronto Blue Jays", "TOR", "American League", AL_EAST, "AL East"],
    [2026, BOS, "Boston Red Sox", "BOS", "American League", AL_EAST, "AL East"],
    [2026, NYM, "New York Mets", "NYM", "National League", NL_EAST, "NL East"],
    [2026, ATL, "Atlanta Braves", "ATL", "National League", NL_EAST, "NL East"],
    [2025, NYY, "New York Yankees", "NYY", "American League", AL_EAST, "AL East"],
    [2025, BAL, "Baltimore Orioles", "BAL", "American League", AL_EAST, "AL East"],
  ];
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, home_score,
        away_score, start_utc, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
    await conn.run(`INSERT INTO game_teams (team_id, season, name, abbreviation, league_name, division_id,
        division_name, game_pk, source_date, source_game_number)
      VALUES ${teams.map(teamRow).join(",")}`);
  });
});

describe("getStandingsSeasons", () => {
  it("lists seasons with games, newest first", async () => {
    expect(await getStandingsSeasons()).toEqual([2026, 2025]);
  });
});

describe("getStandings", () => {
  it("groups divisions by league", async () => {
    const leagues = await getStandings(2026);

    expect(leagues.map((l) => [l.name, l.divisions.map((d) => d.name)])).toEqual([
      ["American League", ["AL East"]],
      ["National League", ["NL East"]],
    ]);
  });

  it("ranks each division with games back, run differential, last 10 and streak", async () => {
    const [american] = await getStandings(2026);

    expect(
      american.divisions[0].teams.map((r) => [
        r.team.abbreviation,
        r.wins,
        r.losses,
        r.pct,
        r.gamesBack,
        r.runDiff,
        r.last10,
        r.streak,
      ]),
    ).toEqual([
      ["BOS", 1, 0, 1, 0, 6, { wins: 1, losses: 0 }, "W1"],
      ["NYY", 3, 1, 0.75, -0.5, 4, { wins: 3, losses: 1 }, "W2"],
      ["TOR", 1, 1, 0.5, 0.5, -3, { wins: 1, losses: 1 }, "L1"],
      ["BAL", 0, 2, 0, 1.5, -6, { wins: 0, losses: 2 }, "L2"],
    ]);
  });

  it("ranks by winning percentage, not games over .500", async () => {
    const [american] = await getStandings(2026);

    expect(american.divisions[0].teams.map((r) => r.team.abbreviation)).toEqual(["BOS", "NYY", "TOR", "BAL"]);
  });

  it("fills the wild card with the best non-leaders, measured from the last spot", async () => {
    const [american, national] = await getStandings(2026);

    expect(american.wildCard.map((r) => [r.team.abbreviation, r.gamesBack])).toEqual([
      ["NYY", -2],
      ["TOR", -1],
      ["BAL", 0],
    ]);
    expect(national.wildCard.map((r) => r.team.abbreviation)).toEqual(["NYM"]);
  });

  it("counts regular-season completed games only", async () => {
    const [american] = await getStandings(2026);

    expect(american.divisions[0].teams.find((r) => r.team.abbreviation === "BOS")).toMatchObject({
      wins: 1,
      losses: 0,
    });
  });

  it("lists teams without games at zero", async () => {
    const [american] = await getStandings(2025);

    expect(american.divisions[0].teams.map((r) => [r.team.abbreviation, r.wins, r.losses, r.streak])).toEqual([
      ["BAL", 1, 0, "W1"],
      ["NYY", 0, 1, "L1"],
    ]);
  });
});
