import { DuckDBInstance } from "@duckdb/node-api";
import { migrate } from "../lib/migrate.ts";

const url = process.env.DUCKDB_URL;
if (!url) throw new Error("DUCKDB_URL is not set");

const conn = await (await DuckDBInstance.create(url)).connect();
await migrate(conn);
conn.closeSync();
