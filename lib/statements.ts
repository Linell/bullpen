import type { DuckDBConnection, DuckDBValue } from "@duckdb/node-api";

export async function runStatements(conn: DuckDBConnection, sql: string, params: Record<string, DuckDBValue>) {
  const statements = await conn.extractStatements(sql);
  for (let i = 0; i < statements.count; i++) {
    const statement = await statements.prepare(i);
    if (statement.parameterCount > 0) statement.bind(params);
    await statement.run();
  }
}

export async function inTransaction<T>(conn: DuckDBConnection, work: () => Promise<T>) {
  await conn.run("BEGIN TRANSACTION");
  try {
    const result = await work();
    await conn.run("COMMIT");
    return result;
  } catch (err) {
    await conn.run("ROLLBACK").catch(() => {});
    throw err;
  }
}
