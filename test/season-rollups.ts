import type { DuckDBConnection } from "@duckdb/node-api";
import { refreshSeasonRollups } from "@/lib/season-rollups";

export async function refreshAllSeasonRollups(conn: DuckDBConnection) {
  const reader = await conn.runAndReadAll(
    "SELECT season FROM games UNION SELECT season FROM game_teams UNION SELECT season FROM plays",
  );
  for (const { season } of reader.getRowObjectsJS()) await refreshSeasonRollups(conn, Number(season));
}
