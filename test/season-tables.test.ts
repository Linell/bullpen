import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { openDb } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { writeSeasonTables } = await import("@/lib/season-tables");
const { openDbMigratedBefore } = await import("./migrations");

const HOME = 111;
const AWAY = 147;
const BATTER = 500;
const PITCHER = 600;

type Game = { gamePk: number; season: number; date: string };

const BUSY_DAY: Game = { gamePk: 1, season: 2026, date: "2026-09-27" };
const NEXT_DAY: Game = { gamePk: 2, season: 2026, date: "2026-09-28" };
const LAST_SEASON: Game = { gamePk: 3, season: 2025, date: "2025-09-28" };

let conn: DuckDBConnection;

async function addGame({ gamePk, season, date }: Game, speeds: number[]) {
  await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number, abstract_state,
      coded_state, detailed_state, home_team_id, away_team_id, start_utc, updated_at)
    VALUES (${gamePk}, ${season}, '${date}', 'R', 1, 'Final', 'F', 'Final', ${HOME}, ${AWAY}, '${date}T23:05:00Z', now())`);
  await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, event_type,
      launch_speed, launch_angle, pitch_count)
    SELECT ${gamePk}, ${season}, i, 1, 'bottom', ${BATTER}, ${PITCHER}, 'single', 100, 12, 1 FROM range(${speeds.length}) t(i)`);
  await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id, pitcher_id,
      balls_before, strikes_before, outs_before, start_speed, call_code, zone, is_in_play, abs_challenged)
    SELECT ${gamePk}, ${season}, i, 0, 1, 'bottom', ${BATTER}, ${PITCHER}, 0, 0, 0, speed, 'S', 5, false, false
    FROM unnest(${JSON.stringify(speeds)}::DOUBLE[]) WITH ORDINALITY t(speed, i)`);
}

async function rowsPerSeason(table: string) {
  const reader = await conn.runAndReadAll(`SELECT season, count(*)::INTEGER AS n FROM ${table} GROUP BY ALL ORDER BY season`);
  return reader.getRowObjectsJS();
}

async function fastestPerDay() {
  const reader = await conn.runAndReadAll(`SELECT strftime(official_date, '%Y-%m-%d') AS date, count(*)::INTEGER AS n,
      min(value) AS slowest, max(value) AS fastest
    FROM event_leaders WHERE board = 'fastest_pitches' GROUP BY ALL ORDER BY date`);
  return reader.getRowObjectsJS();
}

beforeEach(async () => {
  conn = await openDb(":memory:");
  await migrate(conn);
  await addGame(BUSY_DAY, Array.from({ length: 60 }, (_, i) => 40 + i));
  await addGame(NEXT_DAY, [100, 101]);
  await addGame(LAST_SEASON, [95]);
});

describe("writeSeasonTables", () => {
  it("keeps only each day's top events", async () => {
    await writeSeasonTables(conn, 2026);

    expect(await fastestPerDay()).toEqual([
      { date: "2026-09-27", n: 50, slowest: 50, fastest: 99 },
      { date: "2026-09-28", n: 2, slowest: 100, fastest: 101 },
    ]);
  });

  it("rebuilds only the requested season", async () => {
    await writeSeasonTables(conn, 2025);
    await writeSeasonTables(conn, 2026);
    await conn.run("DELETE FROM pitches WHERE season = 2026");
    await conn.run("DELETE FROM plays WHERE season = 2026");
    await writeSeasonTables(conn, 2026);

    for (const table of ["event_leaders", "pitch_outcome_days", "batted_ball_days", "player_season_counts"]) {
      expect(await rowsPerSeason(table), table).toEqual([{ season: 2025, n: expect.any(Number) }]);
    }
    const starters = await conn.runAndReadAll("SELECT DISTINCT game_pk FROM game_starters");
    expect(starters.getRowObjectsJS()).toEqual([{ game_pk: LAST_SEASON.gamePk }]);
  });

  it("leaves the same rows when refreshed twice", async () => {
    await writeSeasonTables(conn, 2026);
    const once = await rowsPerSeason("team_season_batting");
    await writeSeasonTables(conn, 2026);

    expect(await rowsPerSeason("team_season_batting")).toEqual(once);
    expect(await fastestPerDay()).toHaveLength(2);
  });
});

describe("migrate", () => {
  it("fills the tables of every stored season", async () => {
    conn = await openDbMigratedBefore("016_");
    await addGame(NEXT_DAY, [100, 101]);
    await addGame(LAST_SEASON, [95]);
    await migrate(conn);

    expect(await rowsPerSeason("event_leaders")).toEqual([
      { season: 2025, n: 1 },
      { season: 2026, n: 2 },
    ]);
    expect(await rowsPerSeason("player_season_counts")).toEqual([
      { season: 2025, n: 2 },
      { season: 2026, n: 2 },
    ]);
  });
});
