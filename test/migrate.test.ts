import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { migrate } from "@/lib/migrate";

describe("migrate", () => {
  it("applies each migration once", async () => {
    const url = path.join(await mkdtemp(path.join(os.tmpdir(), "bullpen-")), "test.duckdb");
    const conn = await openDb(url);
    await migrate(conn);
    const applied = await conn.runAndReadAll("SELECT file, applied_at FROM schema_migrations");

    await migrate(conn);
    const reapplied = await conn.runAndReadAll("SELECT file, applied_at FROM schema_migrations");
    conn.closeSync();

    expect(applied.getRowObjectsJS().map((row) => row.file)).toContain("010_game_players.sql");
    expect(reapplied.getRowObjectsJS()).toEqual(applied.getRowObjectsJS());
  });
});
