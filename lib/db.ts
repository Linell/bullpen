import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

const SQL_DIR = path.join(process.cwd(), "sql");

// Files under sql/ that are not migrations.
const NON_MIGRATIONS = new Set(["derive.sql"]);

let ready: Promise<DuckDBInstance> | undefined;
let shared: Promise<DuckDBConnection> | undefined;

// The process-wide, migrated instance. MotherDuck reads MOTHERDUCK_TOKEN from the environment.
function instance(): Promise<DuckDBInstance> {
  ready ??= (async () => {
    const url = process.env.DUCKDB_URL;
    if (!url) throw new Error("DUCKDB_URL is not set");
    return openInstance(url);
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

// A shared connection for reads and single-statement writes.
export function db(): Promise<DuckDBConnection> {
  shared ??= instance().then((i) => i.connect());
  return shared;
}

// A dedicated connection, for work that needs its own transaction. Close it when done.
export async function connect(): Promise<DuckDBConnection> {
  return (await instance()).connect();
}

// Opens and migrates a database. Tests pass ":memory:".
export async function openDb(url: string) {
  return (await openInstance(url)).connect();
}

async function openInstance(url: string) {
  const instance = await DuckDBInstance.fromCache(url);
  const conn = await instance.connect();
  await migrate(conn);
  conn.closeSync();
  return instance;
}

// Runs every numbered sql/*.sql file in order. Each must be idempotent.
async function migrate(conn: DuckDBConnection) {
  const files = (await readdir(SQL_DIR))
    .filter((f) => f.endsWith(".sql") && !NON_MIGRATIONS.has(f))
    .sort();
  for (const file of files) {
    await conn.run(await readFile(path.join(SQL_DIR, file), "utf8"));
  }
}

export async function readSql(file: string) {
  return readFile(path.join(SQL_DIR, file), "utf8");
}
