import "server-only";
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";

const SQL_DIR = path.join(process.cwd(), "sql");
const MIGRATION_FILE = /^\d+_.*\.sql$/;

let ready: Promise<DuckDBInstance> | undefined;

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

export async function withConnection<T>(work: (conn: DuckDBConnection) => Promise<T>) {
  const conn = await (await instance()).connect();
  try {
    return await work(conn);
  } finally {
    conn.closeSync();
  }
}

export function readRows<T>(query: string, params: Record<string, DuckDBValue>): Promise<T[]> {
  return withConnection(async (conn) => {
    const reader = await conn.runAndReadAll(query, params);
    return reader.getRowObjectsJS() as unknown as T[];
  });
}

export async function openDb(url: string) {
  return (await openInstance(url)).connect();
}

async function openInstance(url: string) {
  if (process.env.VERCEL) process.env.HOME = os.tmpdir();
  const instance = await DuckDBInstance.fromCache(url);
  const conn = await instance.connect();
  await migrate(conn);
  conn.closeSync();
  return instance;
}

async function migrate(conn: DuckDBConnection) {
  const files = (await readdir(SQL_DIR)).filter((f) => MIGRATION_FILE.test(f)).sort();
  for (const file of files) {
    await conn.run(await readFile(path.join(SQL_DIR, file), "utf8"));
  }
}

export async function readSql(file: string) {
  return readFile(path.join(SQL_DIR, file), "utf8");
}
