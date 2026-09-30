import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { migrate } from "@/lib/migrate";
import { openDbMigratedBefore } from "./migrations";

type EnumType = { type_name: string; labels: string[] };
type Macro = { function_name: string; parameters: string[]; macro_definition: string };
type Column = { table_name: string; column_name: string; data_type: string; is_nullable: boolean; column_default: string | null };
type Key = { table_name: string; constraint_text: string };
type View = { sql: string };

async function readSchema(conn: DuckDBConnection) {
  const read = async <T>(sql: string) => (await conn.runAndReadAll(sql)).getRowObjectsJS() as unknown as T[];
  const [types, macros, columns, keys, views] = await Promise.all([
    read<EnumType>("SELECT type_name, labels FROM duckdb_types() WHERE NOT internal ORDER BY type_name"),
    read<Macro>(`SELECT function_name, parameters, macro_definition
      FROM duckdb_functions() WHERE NOT internal ORDER BY function_name`),
    read<Column>(`SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM duckdb_columns() WHERE NOT internal ORDER BY table_name, column_index`),
    read<Key>("SELECT table_name, constraint_text FROM duckdb_constraints() WHERE constraint_type <> 'NOT NULL'"),
    read<View>("SELECT sql FROM duckdb_views() WHERE NOT internal ORDER BY view_name"),
  ]);

  const columnLine = (c: Column) =>
    [c.column_name, c.data_type, !c.is_nullable && "NOT NULL", c.column_default && `DEFAULT ${c.column_default}`]
      .filter(Boolean)
      .join(" ");
  const tableNames = [...new Set(columns.map((c) => c.table_name))];
  const tables = tableNames.map((table) => {
    const lines = [
      ...columns.filter((c) => c.table_name === table).map(columnLine),
      ...keys.filter((k) => k.table_name === table).map((k) => k.constraint_text),
    ];
    return `CREATE TABLE ${table} (\n  ${lines.join(",\n  ")}\n);`;
  });

  const statements = [
    ...types.map((t) => `CREATE TYPE ${t.type_name} AS ENUM (${t.labels.map((l) => `'${l}'`).join(", ")});`),
    ...macros.map((m) => `CREATE MACRO ${m.function_name}(${m.parameters.join(", ")}) AS ${m.macro_definition};`),
    ...tables,
    ...views.map((v) => v.sql),
  ];
  return statements.join("\n\n") + "\n";
}

describe("migrate", () => {
  it("matches the schema snapshot in sql/schema.sql", async () => {
    const conn = await openDb(":memory:");
    await migrate(conn);
    const schema = await readSchema(conn);
    conn.closeSync();

    await expect(schema).toMatchFileSnapshot("../sql/schema.sql");
  });

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
    const conn = await openDbMigratedBefore("011_");
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
