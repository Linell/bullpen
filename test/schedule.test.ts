import { readFileSync } from "node:fs";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import type { ScheduleResponse } from "@/lib/mlb";
import { diffGames, parseSchedule, upsertGames, wasPlayed } from "@/lib/schedule";

function fixture(name: string): ScheduleResponse {
  const file = path.join(import.meta.dirname, "fixtures/schedule", `${name}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

const byPk = (rows: { gamePk: number }[]) => rows.map((r) => r.gamePk).sort();

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
});

describe("wasPlayed", () => {
  it("is true only for F and O", () => {
    expect(["F", "O", "D", "S", "I", "P"].map(wasPlayed)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("diffGames", () => {
  it("flags a score change but not newly final", () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    const live = { ...row, codedState: "I", abstractState: "Live", detailedState: "In Progress" };
    const prev = new Map([[row.gamePk, live]]);
    const scored = { ...live, homeScore: (live.homeScore ?? 0) + 1 };
    expect(diffGames(prev, [scored])).toMatchObject({ scoreChanges: [scored], newlyFinal: [] });
  });

  it("publishes a postponed game moving to its makeup date", () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    const moved = { ...row, officialDate: "2026-09-22" };
    const diff = diffGames(new Map([[row.gamePk, row]]), [moved]);
    expect(diff.scoreChanges).toEqual([moved]);
  });

  it("writes but does not publish a record-only change", () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    const next = { ...row, homeRecord: "1-0" };
    const diff = diffGames(new Map([[row.gamePk, row]]), [next]);
    expect(diff).toEqual({ scoreChanges: [], newlyFinal: [], dirty: [next] });
  });
});

describe("upsertGames", () => {
  let conn: DuckDBConnection;
  beforeEach(async () => {
    conn = await openDb(":memory:");
    await conn.run("DELETE FROM games");
  });

  it("does not treat a postponed game as final", async () => {
    const rows = parseSchedule(fixture("2026-09-22"));
    const postponed = rows.find((r) => r.gamePk === 824785)!;
    expect(postponed).toMatchObject({ abstractState: "Final", codedState: "D" });
    const { scoreChanges, newlyFinal } = await upsertGames(conn, rows);
    expect(scoreChanges).toHaveLength(rows.length);
    expect(byPk(newlyFinal)).toEqual([823543]);
  });

  it("reports newly final games exactly once", async () => {
    const rows = parseSchedule(fixture("2026-09-21"));
    const first = await upsertGames(conn, rows);
    expect(byPk(first.newlyFinal)).toEqual(byPk(rows));
    const second = await upsertGames(conn, rows);
    expect(second).toEqual({ scoreChanges: [], newlyFinal: [] });
  });

  it("round-trips every column", async () => {
    const rows = parseSchedule(fixture("2026-09-22"));
    await upsertGames(conn, rows);
    const reader = await conn.runAndReadAll("SELECT count(*)::INTEGER AS n FROM games");
    expect(reader.getRowObjectsJS()[0].n).toBe(rows.length);
    expect(await upsertGames(conn, rows)).toEqual({ scoreChanges: [], newlyFinal: [] });
  });

  it("publishes a score change without re-finalizing", async () => {
    const rows = parseSchedule(fixture("2026-09-22"));
    await upsertGames(conn, rows);
    const target = rows.find((r) => r.codedState === "P")!;
    const live = { ...target, codedState: "I", abstractState: "Live", detailedState: "In Progress" };
    const r1 = await upsertGames(conn, [live]);
    expect(r1).toEqual({ scoreChanges: [live], newlyFinal: [] });
    const scored = { ...live, homeScore: 1 };
    expect(await upsertGames(conn, [scored])).toEqual({ scoreChanges: [scored], newlyFinal: [] });
    const final = { ...scored, codedState: "F", abstractState: "Final", detailedState: "Final" };
    expect(await upsertGames(conn, [final])).toEqual({ scoreChanges: [final], newlyFinal: [final] });
    expect(await upsertGames(conn, [final])).toEqual({ scoreChanges: [], newlyFinal: [] });
  });

  it("writes rows that differ outside the live fields", async () => {
    const [row] = parseSchedule(fixture("2026-09-21"));
    await upsertGames(conn, [row]);
    await upsertGames(conn, [{ ...row, homeRecord: "1-0" }]);
    const reader = await conn.runAndReadAll(
      `SELECT home_record FROM games WHERE game_pk = ${row.gamePk}`,
    );
    expect(reader.getRowObjectsJS()[0].home_record).toBe("1-0");
  });
});
