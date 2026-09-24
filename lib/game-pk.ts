import "server-only";
import { readRows } from "@/lib/db";

export const GAME_PK_RE = /^\d{1,9}$/;

export async function gameExists(gamePk: number): Promise<boolean> {
  const rows = await readRows<{ found: number }>(
    "SELECT 1 AS found FROM games WHERE game_pk = $gamePk LIMIT 1",
    { gamePk },
  );
  return rows.length > 0;
}
