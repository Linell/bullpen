import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";

export const SQL_DIR = path.join(process.cwd(), "sql");
const MIGRATION_FILE = /^\d+_.*\.sql$/;

export async function migrate(conn: DuckDBConnection) {
  await conn.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (file VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)",
  );
  const reader = await conn.runAndReadAll("SELECT file FROM schema_migrations");
  const applied = new Set(reader.getRowObjectsJS().map((row) => row.file));
  const files = (await readdir(SQL_DIR)).filter((f) => MIGRATION_FILE.test(f)).sort();

  for (const file of files.filter((f) => !applied.has(f))) {
    await conn.run("BEGIN TRANSACTION");
    try {
      await conn.run(await readFile(path.join(SQL_DIR, file), "utf8"));
      await conn.run("INSERT INTO schema_migrations VALUES ($file, now())", { file });
      await conn.run("COMMIT");
    } catch (err) {
      await conn.run("ROLLBACK");
      throw err;
    }
  }
}
