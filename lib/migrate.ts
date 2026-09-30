import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
// Relative .ts imports: scripts/migrate.ts runs in bare node.
import { writeAllSeasonRollups } from "./season-rollups.ts";
import { inTransaction } from "./statements.ts";

export const SQL_DIR = path.join(process.cwd(), "sql");
const MIGRATION_FILE = /^\d+_.*\.sql$/;

export async function migrate(conn: DuckDBConnection) {
  await conn.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (file VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)",
  );
  const reader = await conn.runAndReadAll("SELECT file FROM schema_migrations");
  const applied = new Set(reader.getRowObjectsJS().map((row) => row.file));
  const files = (await readdir(SQL_DIR)).filter((f) => MIGRATION_FILE.test(f)).sort();
  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) return;

  await inTransaction(conn, async () => {
    for (const file of pending) {
      await conn.run(await readFile(path.join(SQL_DIR, file), "utf8"));
      await conn.run("INSERT INTO schema_migrations VALUES ($file, now())", { file });
    }
    await writeAllSeasonRollups(conn);
  });
}
