import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { recordProbables } from "@/lib/probables";

const GAME = 900001;

async function setProbables(
  conn: DuckDBConnection,
  home: [number, string] | null,
  away: [number, string] | null,
) {
  await conn.run(
    `INSERT OR REPLACE INTO games (game_pk, season, official_date, game_type, game_number,
       abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc,
       home_probable_id, home_probable_name, away_probable_id, away_probable_name, updated_at)
     VALUES ($gamePk, 2026, '2026-09-24', 'R', 1, 'Preview', 'S', 'Scheduled', 110, 141,
       '2026-09-24T23:05:00Z', $homeId, $homeName, $awayId, $awayName, now())`,
    {
      gamePk: GAME,
      homeId: home?.[0] ?? null,
      homeName: home?.[1] ?? null,
      awayId: away?.[0] ?? null,
      awayName: away?.[1] ?? null,
    },
  );
}

async function history(conn: DuckDBConnection) {
  const reader = await conn.runAndReadAll(
    `SELECT side::VARCHAR AS side, pitcher_id, pitcher_name FROM probable_pitchers
     ORDER BY observed_at, side`,
  );
  return reader.getRowObjectsJS();
}

describe("recordProbables", () => {
  let conn: DuckDBConnection;
  beforeEach(async () => {
    conn = await openDb(":memory:");
    await conn.run("DELETE FROM games");
    await conn.run("DELETE FROM probable_pitchers");
  });

  it("records the first observation for each named side", async () => {
    await setProbables(conn, [1, "Home Ace"], [2, "Away Ace"]);
    expect(await recordProbables(conn, [GAME])).toEqual([GAME]);
    expect(await history(conn)).toEqual([
      { side: "away", pitcher_id: 2, pitcher_name: "Away Ace" },
      { side: "home", pitcher_id: 1, pitcher_name: "Home Ace" },
    ]);
  });

  it("does nothing when the probables are unchanged", async () => {
    await setProbables(conn, [1, "Home Ace"], [2, "Away Ace"]);
    await recordProbables(conn, [GAME]);
    expect(await recordProbables(conn, [GAME])).toEqual([]);
    expect(await history(conn)).toHaveLength(2);
  });

  it("records a changed probable", async () => {
    await setProbables(conn, [1, "Home Ace"], [2, "Away Ace"]);
    await recordProbables(conn, [GAME]);
    await setProbables(conn, [3, "Home Swingman"], [2, "Away Ace"]);
    expect(await recordProbables(conn, [GAME])).toEqual([GAME]);
    expect((await history(conn)).at(-1)).toEqual({
      side: "home",
      pitcher_id: 3,
      pitcher_name: "Home Swingman",
    });
  });

  it("records a TBD after a named pitcher", async () => {
    await setProbables(conn, [1, "Home Ace"], null);
    await recordProbables(conn, [GAME]);
    await setProbables(conn, null, null);
    expect(await recordProbables(conn, [GAME])).toEqual([GAME]);
    expect(await history(conn)).toEqual([
      { side: "home", pitcher_id: 1, pitcher_name: "Home Ace" },
      { side: "home", pitcher_id: null, pitcher_name: null },
    ]);
    expect(await recordProbables(conn, [GAME])).toEqual([]);
  });

  it("does not record a TBD before any pitcher is named", async () => {
    await setProbables(conn, null, null);
    expect(await recordProbables(conn, [GAME])).toEqual([]);
    expect(await history(conn)).toEqual([]);
  });
});
