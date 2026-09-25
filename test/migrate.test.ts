import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { migrate, SQL_DIR } from "@/lib/migrate";

describe("migrate", () => {
  it("applies each migration once", async () => {
    const url = path.join(await mkdtemp(path.join(os.tmpdir(), "bullpen-")), "test.duckdb");
    const conn = await openDb(url);
    await migrate(conn);
    const applied = await conn.runAndReadAll("SELECT file, applied_at FROM schema_migrations");

    await migrate(conn);
    const reapplied = await conn.runAndReadAll("SELECT file, applied_at FROM schema_migrations");
    conn.closeSync();

    expect(applied.getRowObjectsJS().map((row) => row.file)).toContain("011_per_game_players_and_teams.sql");
    expect(reapplied.getRowObjectsJS()).toEqual(applied.getRowObjectsJS());
  });

  it("keeps the stored players and teams when they become per-game rows", async () => {
    const conn = await openDb(":memory:");
    await conn.run("CREATE TABLE schema_migrations (file VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)");
    const earlier = (await readdir(SQL_DIR)).filter((file) => /^\d+_/.test(file) && file < "011_").sort();
    for (const file of earlier) {
      await conn.run(await readFile(path.join(SQL_DIR, file), "utf8"));
      await conn.run("INSERT INTO schema_migrations VALUES ($file, now())", { file });
    }
    await conn.run(`INSERT INTO players (player_id, full_name, bat_side, source_game_pk, source_date, source_game_number)
      VALUES (547180, 'Bryce Harper', 'L', 30, '2026-09-20', 2)`);
    await conn.run(`INSERT INTO teams (team_id, season, name, abbreviation, source_game_pk, source_date, source_game_number)
      VALUES (133, 2024, 'Oakland Athletics', 'OAK', 10, '2024-09-26', 1),
        (133, 2026, 'Athletics', 'ATH', 20, '2026-09-20', 1)`);

    await migrate(conn);

    const read = async (sql: string) => (await conn.runAndReadAll(sql)).getRowObjectsJson();
    expect(await read("SELECT game_pk, player_id, full_name, bat_side::VARCHAR AS bat_side FROM game_player_bios")).toEqual([
      { game_pk: 30, player_id: 547180, full_name: "Bryce Harper", bat_side: "L" },
    ]);
    expect(await read("SELECT player_id, full_name, source_game_pk, source_game_number FROM players")).toEqual([
      { player_id: 547180, full_name: "Bryce Harper", source_game_pk: 30, source_game_number: 2 },
    ]);
    expect(await read("SELECT season, name, abbreviation, source_game_pk FROM teams ORDER BY season")).toEqual([
      { season: 2024, name: "Oakland Athletics", abbreviation: "OAK", source_game_pk: 10 },
      { season: 2026, name: "Athletics", abbreviation: "ATH", source_game_pk: 20 },
    ]);
    conn.closeSync();
  });
});
