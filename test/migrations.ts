import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { openDb } from "@/lib/db";
import { SQL_DIR } from "@/lib/migrate";

export async function openDbMigratedBefore(file: string) {
  const conn = await openDb(":memory:");
  await conn.run("CREATE TABLE schema_migrations (file VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)");
  const earlier = (await readdir(SQL_DIR)).filter((name) => /^\d+_/.test(name) && name < file).sort();
  for (const name of earlier) {
    await conn.run(await readFile(path.join(SQL_DIR, name), "utf8"));
    await conn.run("INSERT INTO schema_migrations VALUES ($file, now())", { file: name });
  }
  return conn;
}
