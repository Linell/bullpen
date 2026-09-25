import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { getGameDetail } = await import("@/lib/game-detail");
const { gameExists } = await import("@/lib/games");

const HOME = 110;
const AWAY = 141;
const OTHER = 147;
const COLE = 543037;

type Seed = {
  gamePk: number;
  date: string;
  home: number;
  away: number;
  score?: [home: number, away: number];
  probables?: [home: number | null, away: number | null];
};

function gameRow({ gamePk, date, home, away, score, probables }: Seed) {
  const [state, coded] = score ? ["Final", "F"] : ["Preview", "S"];
  return `(${gamePk}, 2026, '${date}', 'R', 1, '${state}', '${coded}', '${state}', ${home}, ${away},
    ${score?.[0] ?? "NULL"}, ${score?.[1] ?? "NULL"}, '${date}T23:05:00Z',
    ${probables?.[0] ?? "NULL"}, ${probables?.[0] ? "'Gerrit Cole'" : "NULL"},
    ${probables?.[1] ?? "NULL"}, NULL, now())`;
}

beforeAll(async () => {
  const games: Seed[] = [
    { gamePk: 1, date: "2026-09-20", home: HOME, away: AWAY, score: [5, 3] },
    { gamePk: 2, date: "2026-09-21", home: HOME, away: OTHER, score: [1, 4] },
    { gamePk: 3, date: "2026-09-22", home: AWAY, away: HOME, score: [2, 6] },
    { gamePk: 4, date: "2026-09-24", home: HOME, away: AWAY, probables: [COLE, null] },
    { gamePk: 5, date: "2026-09-25", home: HOME, away: AWAY, score: [9, 0] },
  ];
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, home_score,
        away_score, start_utc, home_probable_id, home_probable_name, away_probable_id,
        away_probable_name, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
    await conn.run(`INSERT INTO game_decisions VALUES (1, 2026, ${COLE}, NULL, NULL),
      (2, 2026, 999, ${COLE}, NULL), (3, 2026, ${COLE}, NULL, NULL), (5, 2026, ${COLE}, NULL, NULL)`);
    await conn.run(`INSERT INTO players (player_id, season, full_name, boxscore_name, pitch_hand,
        source_game_pk, source_date, source_game_number)
      VALUES (${COLE}, 2026, 'Gerrit Cole', 'Cole, G', 'R', 1, '2026-09-20', 1)`);
  });
});

describe("getGameDetail", () => {
  it("builds the pregame matchup from earlier games", async () => {
    const detail = await getGameDetail(4);

    expect(detail?.homeForm.results.map((r) => r.gamePk)).toEqual([3, 2, 1]);
    expect(detail?.homeForm.streak).toBe("W1");
    expect(detail?.awayForm.results.map((r) => r.won)).toEqual([false, false]);
    expect(detail?.headToHead.results.map((r) => r.gamePk)).toEqual([5, 3, 1]);
    expect(detail?.headToHead.record).toEqual({ awayWins: 0, homeWins: 3 });
  });

  it("shows probable starters with prior-game stats", async () => {
    const detail = await getGameDetail(4);

    expect(detail?.starters.home).toEqual({
      name: "Cole, G",
      hand: "R",
      wins: 2,
      losses: 1,
      starts: 0,
      strikeouts: 0,
    });
    expect(detail?.starters.away).toEqual({ wins: 0, losses: 0, starts: 0, strikeouts: 0 });
  });
});

describe("gameExists", () => {
  it("is true for a seeded game and false otherwise", async () => {
    expect(await gameExists(1)).toBe(true);
    expect(await gameExists(999999999)).toBe(false);
  });
});
