import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { getTeamSeasons, getTeamSummary } = await import("@/lib/team-summary");

const NYY = 147;
const BAL = 110;
const TOR = 141;
const NYM = 121;
const AL_EAST = 201;
const NL_EAST = 204;

type Seed = {
  gamePk: number;
  date: string;
  home: number;
  away: number;
  score?: [home: number, away: number];
};

function gameRow({ gamePk, date, home, away, score }: Seed) {
  const [state, coded] = score ? ["Final", "F"] : ["Preview", "S"];
  return `(${gamePk}, ${date.slice(0, 4)}, '${date}', 'R', 1, '${state}', '${coded}', '${state}', ${home}, ${away},
    ${score?.[0] ?? "NULL"}, ${score?.[1] ?? "NULL"}, '${date}T23:05:00Z', now())`;
}

function teamRow(id: number, name: string, abbr: string, league: string, divisionId: number, division: string) {
  return `(${id}, 2026, '${name}', '${abbr}', '${league}', ${divisionId}, '${division}', 1, '2026-09-20', 1)`;
}

beforeAll(async () => {
  const games: Seed[] = [
    { gamePk: 1, date: "2026-09-20", home: NYY, away: BAL, score: [5, 3] },
    { gamePk: 2, date: "2026-09-21", home: NYY, away: TOR, score: [1, 4] },
    { gamePk: 3, date: "2026-09-22", home: BAL, away: NYY, score: [2, 6] },
    { gamePk: 4, date: "2026-09-23", home: NYY, away: NYM, score: [3, 2] },
    { gamePk: 5, date: "2026-09-27", home: NYY, away: BAL },
    { gamePk: 6, date: "2025-09-20", home: NYY, away: BAL, score: [0, 1] },
  ];
  await withConnection(async (conn) => {
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, home_score,
        away_score, start_utc, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
    await conn.run(`INSERT INTO teams (team_id, season, name, abbreviation, league_name, division_id,
        division_name, source_game_pk, source_date, source_game_number)
      VALUES ${[
        teamRow(NYY, "New York Yankees", "NYY", "American League", AL_EAST, "AL East"),
        teamRow(BAL, "Baltimore Orioles", "BAL", "American League", AL_EAST, "AL East"),
        teamRow(TOR, "Toronto Blue Jays", "TOR", "American League", AL_EAST, "AL East"),
        teamRow(NYM, "New York Mets", "NYM", "National League", NL_EAST, "NL East"),
      ].join(",")}`);
  });
});

describe("getTeamSeasons", () => {
  it("lists seasons with games, newest first", async () => {
    expect(await getTeamSeasons(NYY)).toEqual([2026, 2025]);
  });

  it("is empty for an unknown team", async () => {
    expect(await getTeamSeasons(999)).toEqual([]);
  });
});

describe("getTeamSummary", () => {
  it("summarizes the current season", async () => {
    const summary = await getTeamSummary(NYY, 2026);

    expect(summary?.team).toEqual({
      id: NYY,
      name: "New York Yankees",
      abbreviation: "NYY",
      league: "American League",
      division: "AL East",
    });
    expect(summary?.record).toEqual({
      wins: 3,
      losses: 1,
      runsScored: 15,
      runsAllowed: 11,
      runDiff: 4,
      pythag: { wins: 3, losses: 1 },
      streak: "W2",
      last10: { wins: 3, losses: 1 },
    });
    expect(summary?.recentGames.map((g) => g.gamePk)).toEqual([4, 3, 2, 1]);
    expect(summary?.upcomingGames.map((g) => g.gamePk)).toEqual([5]);
  });

  it("ranks the division by record", async () => {
    const summary = await getTeamSummary(NYY, 2026);

    expect(
      summary?.standings.map((r) => [r.team.abbreviation, r.wins, r.losses, r.pct, r.gamesBack]),
    ).toEqual([
      ["NYY", 3, 1, 0.75, 0],
      ["TOR", 1, 0, 1, 0.5],
      ["BAL", 0, 2, 0, 2],
    ]);
  });

  it("skips upcoming games for a past season", async () => {
    const summary = await getTeamSummary(NYY, 2025);

    expect(summary?.record).toMatchObject({ wins: 0, losses: 1, streak: "L1" });
    expect(summary?.upcomingGames).toEqual([]);
  });

  it("is undefined for an unknown team", async () => {
    expect(await getTeamSummary(999, 2026)).toBeUndefined();
  });
});
