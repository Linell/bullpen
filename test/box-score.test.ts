import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { writeAllSeasonRollups } = await import("@/lib/season-rollups");
const { withConnection, readRows } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { getBoxScore } = await import("@/lib/box-score");

const HOME = 110;
const AWAY = 141;
const FINAL = 1;
const SCHEDULED = 2;

type Row = Record<string, number | boolean | string | null>;

const DEFAULTS: Record<string, number | boolean | null> = { INTEGER: 0, BOOLEAN: false };

async function insertZeroed(table: string, rows: Row[]) {
  const columns = await readRows<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`,
    {},
  );
  const values = rows.map((row) => {
    const cells = columns.map(({ column_name, data_type }) => {
      const value = row[column_name] ?? DEFAULTS[data_type] ?? null;
      return typeof value === "string" ? `'${value}'` : String(value);
    });
    return `(${cells.join(",")})`;
  });
  await withConnection((conn) => conn.run(`INSERT INTO ${table} VALUES ${values.join(",")}`));
}

function player(playerId: number, side: "away" | "home", order: number | null, position: string, sub = false) {
  return {
    game_pk: FINAL,
    season: 2026,
    player_id: playerId,
    team_id: side === "home" ? HOME : AWAY,
    side,
    position,
    batting_order: order ?? 0,
    is_substitute: sub,
    played: true,
  };
}

beforeAll(async () => {
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, home_score,
        away_score, start_utc, updated_at)
      VALUES (${FINAL}, 2026, '2026-09-20', 'R', 1, 'Final', 'F', 'Final', ${HOME}, ${AWAY}, 5, 3, '2026-09-20T23:05:00Z', now()),
        (${SCHEDULED}, 2026, '2026-09-30', 'R', 1, 'Preview', 'S', 'Preview', ${HOME}, ${AWAY}, NULL, NULL, '2026-09-30T23:05:00Z', now())`);
    await conn.run(`INSERT INTO game_player_bios (player_id, full_name, boxscore_name, game_pk, source_date, source_game_number)
      VALUES (10, 'Ann Lead', 'Lead, A', 1, '2026-09-20', 1), (11, 'Bo Second', 'Second, B', 1, '2026-09-20', 1),
        (12, 'Cy Sub', 'Sub, C', 1, '2026-09-20', 1), (20, 'Dee Starter', 'Starter, D', 1, '2026-09-20', 1),
        (21, 'Eve Closer', 'Closer, E', 1, '2026-09-20', 1)`);
  });
  await insertZeroed("game_players", [
    player(11, "home", 200, "1B"),
    player(12, "home", 201, "PH", true),
    player(10, "home", 100, "SS"),
    player(20, "away", null, "P"),
    player(21, "away", null, "P"),
  ]);
  await insertZeroed("player_game_batting", [
    { game_pk: FINAL, season: 2026, player_id: 11, team_id: HOME, at_bats: 4, hits: 2, rbi: 3, strikeouts: 1 },
    { game_pk: FINAL, season: 2026, player_id: 12, team_id: HOME, at_bats: 1, runs: 1, walks: 1 },
    { game_pk: FINAL, season: 2026, player_id: 10, team_id: HOME, at_bats: 3, runs: 2, hits: 1 },
  ]);
  await insertZeroed("player_game_pitching", [
    { game_pk: FINAL, season: 2026, player_id: 21, team_id: AWAY, outs: 4, pitches: 20, is_save: true },
    { game_pk: FINAL, season: 2026, player_id: 20, team_id: AWAY, is_starter: true, outs: 19, hits: 6, runs: 5, earned_runs: 4, strikeouts: 7, home_runs: 1, pitches: 98, is_loss: true },
  ]);
  await insertZeroed("plays", [
    { game_pk: FINAL, season: 2026, at_bat_index: 0, inning: 1, half: "top", batter_id: 10, pitcher_id: 20 },
    { game_pk: FINAL, season: 2026, at_bat_index: 60, inning: 7, half: "bottom", batter_id: 10, pitcher_id: 21 },
  ]);
  await withConnection(writeAllSeasonRollups);
});

describe("getBoxScore", () => {
  it("orders batters by lineup slot with substitutes after the starter they replaced", async () => {
    const box = await getBoxScore(FINAL);

    expect(box?.home.batting.map((l) => [l.player.name, l.position, l.isSubstitute])).toEqual([
      ["Lead, A", "SS", false],
      ["Second, B", "1B", false],
      ["Sub, C", "PH", true],
    ]);
    expect(box?.home.batting[1]).toMatchObject({ atBats: 4, hits: 2, rbi: 3, strikeouts: 1 });
    expect(box?.away.batting).toEqual([]);
  });

  it("lists pitchers in appearance order with innings and decisions", async () => {
    const box = await getBoxScore(FINAL);

    expect(box?.away.pitching.map((l) => [l.player.name, l.innings, l.decision])).toEqual([
      ["Starter, D", "6.1", "L"],
      ["Closer, E", "1.1", "S"],
    ]);
    expect(box?.away.pitching[0]).toMatchObject({ hits: 6, runs: 5, earnedRuns: 4, strikeouts: 7, homeRuns: 1, pitches: 98 });
  });

  it("returns nothing for a game with no lines or an unknown game", async () => {
    expect(await getBoxScore(SCHEDULED)).toBeUndefined();
    expect(await getBoxScore(999)).toBeUndefined();
  });
});
