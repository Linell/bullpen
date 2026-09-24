import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";

describe("openDb", () => {
  it("applies each migration once", async () => {
    const url = path.join(await mkdtemp(path.join(os.tmpdir(), "bullpen-")), "test.duckdb");
    const first = await openDb(url);
    const applied = await first.runAndReadAll("SELECT file, applied_at FROM schema_migrations");
    first.closeSync();

    const second = await openDb(url);
    const reapplied = await second.runAndReadAll("SELECT file, applied_at FROM schema_migrations");
    second.closeSync();

    expect(applied.getRowObjectsJS().map((row) => row.file)).toContain("006_probables.sql");
    expect(reapplied.getRowObjectsJS()).toEqual(applied.getRowObjectsJS());
  });
});
