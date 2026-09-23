import { readFileSync } from "node:fs";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import type { ScheduleResponse } from "@/lib/mlb";
import { changedGames, findCompletedGamePks, isCompleted, parseSchedule, upsertGames } from "@/lib/schedule";

function fixture(name: string): ScheduleResponse {
  const file = path.join(import.meta.dirname, "fixtures/schedule", `${name}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("parseSchedule", () => {
  it("maps a final game", () => {
    const rows = parseSchedule(fixture("2026-09-21"));
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.gamePk === 824787)).toEqual({
      gamePk: 824787,
      season: 2026,
      officialDate: "2026-09-21",
      gameType: "R",
      gameNumber: 1,
      doubleHeader: null,
      rescheduledFrom: null,
      abstractState: "Final",
      codedState: "F",
      detailedState: "Final",
      homeTeamId: 110,
      awayTeamId: 141,
      homeScore: 4,
      awayScore: 3,
      inning: 9,
      inningHalf: "Top",
      startUtc: "2026-09-21T22:35:00.000Z",
      venueName: "Oriole Park at Camden Yards",
      homeRecord: "76-81",
      awayRecord: "77-80",
    });
  });

  it("leaves scores and inning null before a game starts", () => {
    const row = parseSchedule(fixture("2026-09-22")).find((r) => r.gamePk === 823494)!;
    expect(row.codedState).toBe("S");
    expect([row.homeScore, row.awayScore, row.inning, row.inningHalf]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("keeps the makeup-date entry of a postponed game", () => {
    const rows = parseSchedule(fixture("2026-07-21_2026-07-22"));
    expect(rows).toHaveLength(4);
    const row = rows.find((r) => r.gamePk === 823519)!;
    expect(row).toMatchObject({
      codedState: "F",
      officialDate: "2026-07-22",
      gameNumber: 2,
      startUtc: "2026-07-22T23:05:00.000Z",
      homeScore: 2,
      awayScore: 0,
    });
  });

  it("keeps doubleheader games distinct", () => {
    const rows = parseSchedule(fixture("2026-07-21_2026-07-22")).filter(
      (r) => r.homeTeamId === 147,
    );
    expect(rows.map((r) => [r.gamePk, r.gameNumber])).toEqual(
      expect.arrayContaining([
        [823518, 1],
        [823519, 2],
      ]),
    );
    expect(rows[0].homeScore).not.toBe(rows[1].homeScore);
  });

  it("maps doubleheader and makeup fields", () => {
    const rows = parseSchedule(fixture("2026-09-23"));
    const fields = (pk: number) => {
      const row = rows.find((r) => r.gamePk === pk)!;
      return [row.gameNumber, row.doubleHeader, row.rescheduledFrom];
    };
    expect(fields(824785)).toEqual([1, "S", "2026-09-22"]);
    expect(fields(824784)).toEqual([2, "S", null]);
    expect(fields(823492)).toEqual([1, "N", null]);
  });
});

describe("isCompleted", () => {
  it("is true for final, game over and forfeit states", () => {
    expect(["F", "O", "Q", "R", "D", "S", "I", "P"].map(isCompleted)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("findCompletedGamePks", () => {
  it("skips a postponed game", () => {
    const rows = parseSchedule(fixture("2026-09-22"));
    const postponed = rows.find((r) => r.gamePk === 824785)!;
    expect(postponed).toMatchObject({ abstractState: "Final", codedState: "D" });
    expect(findCompletedGamePks(rows)).toEqual([823543]);
  });

  it("includes a forfeit", () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    const forfeit = { ...row, codedState: "Q", detailedState: "Completed Early: Forfeit" };
    expect(findCompletedGamePks([forfeit])).toEqual([row.gamePk]);
  });
});

describe("changedGames", () => {
  it("flags a score change", () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    const scored = { ...row, homeScore: (row.homeScore ?? 0) + 1 };
    expect(changedGames(new Map([[row.gamePk, row]]), [scored])).toEqual([scored]);
  });

  it("ignores unchanged rows", () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    expect(changedGames(new Map([[row.gamePk, row]]), [row])).toEqual([]);
  });
});

describe("upsertGames", () => {
  let conn: DuckDBConnection;
  beforeEach(async () => {
    conn = await openDb(":memory:");
    await conn.run("DELETE FROM games");
  });

  it("writes only rows that changed", async () => {
    const rows = parseSchedule(fixture("2026-09-21"));
    expect(await upsertGames(conn, rows)).toEqual({ changed: rows.length });
    expect(await upsertGames(conn, rows)).toEqual({ changed: 0 });
    const [row] = rows;
    expect(await upsertGames(conn, [{ ...row, homeScore: (row.homeScore ?? 0) + 1 }])).toEqual({ changed: 1 });
  });

  it("round-trips every column", async () => {
    const rows = parseSchedule(fixture("2026-09-22"));
    await upsertGames(conn, rows);
    const reader = await conn.runAndReadAll("SELECT count(*)::INTEGER AS n FROM games");
    expect(reader.getRowObjectsJS()[0].n).toBe(rows.length);
    const [row] = rows;
    const prev = await conn.runAndReadAll(
      `SELECT epoch_ms(updated_at) AS t FROM games WHERE game_pk = ${row.gamePk}`,
    );
    await upsertGames(conn, rows);
    const next = await conn.runAndReadAll(
      `SELECT epoch_ms(updated_at) AS t FROM games WHERE game_pk = ${row.gamePk}`,
    );
    expect(next.getRowObjectsJS()).toEqual(prev.getRowObjectsJS());
  });

  it("round-trips doubleheader and makeup fields", async () => {
    const rows = parseSchedule(fixture("2026-09-23"));
    expect(await upsertGames(conn, rows)).toEqual({ changed: rows.length });
    expect(await upsertGames(conn, rows)).toEqual({ changed: 0 });
  });

  it("writes rows that differ outside the status fields", async () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    await upsertGames(conn, [row]);
    await upsertGames(conn, [{ ...row, homeRecord: "1-0" }]);
    const reader = await conn.runAndReadAll(
      `SELECT home_record FROM games WHERE game_pk = ${row.gamePk}`,
    );
    expect(reader.getRowObjectsJS()[0].home_record).toBe("1-0");
  });
});
