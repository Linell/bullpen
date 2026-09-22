import type { DuckDBConnection, DuckDBValue } from "@duckdb/node-api";
import type { ScoreUpdate } from "@/lib/inngest/realtime";
import type { ScheduleGame, ScheduleResponse } from "@/lib/mlb";

// One row of the `games` table. `updated_at` is set on write.
export type GameRow = {
  gamePk: number;
  season: number;
  officialDate: string; // YYYY-MM-DD
  gameType: string;
  gameNumber: number;
  abstractState: string;
  codedState: string;
  detailedState: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  inning: number | null;
  inningHalf: string | null;
  startUtc: string; // ISO 8601, UTC
  venueName: string | null;
  homeRecord: string | null; // "W-L"
  awayRecord: string | null;
};

// Column order shared by the read and the write. [row key, column, SQL type].
const COLUMNS = [
  ["gamePk", "game_pk", "INTEGER"],
  ["season", "season", "INTEGER"],
  ["officialDate", "official_date", "DATE"],
  ["gameType", "game_type", "VARCHAR"],
  ["gameNumber", "game_number", "INTEGER"],
  ["abstractState", "abstract_state", "VARCHAR"],
  ["codedState", "coded_state", "VARCHAR"],
  ["detailedState", "detailed_state", "VARCHAR"],
  ["homeTeamId", "home_team_id", "INTEGER"],
  ["awayTeamId", "away_team_id", "INTEGER"],
  ["homeScore", "home_score", "INTEGER"],
  ["awayScore", "away_score", "INTEGER"],
  ["inning", "inning", "INTEGER"],
  ["inningHalf", "inning_half", "VARCHAR"],
  ["startUtc", "start_utc", "TIMESTAMPTZ"],
  ["venueName", "venue_name", "VARCHAR"],
  ["homeRecord", "home_record", "VARCHAR"],
  ["awayRecord", "away_record", "VARCHAR"],
] as const satisfies readonly (readonly [keyof GameRow, string, string])[];

// Fields the scoreboard shows. A difference here means a realtime update.
const LIVE_FIELDS = [
  "abstractState",
  "codedState",
  "detailedState",
  "homeScore",
  "awayScore",
  "inning",
  "inningHalf",
] as const satisfies readonly (keyof GameRow)[];

const INSERT_CHUNK = 500;

// Final (F) or completed early (O). Postponed games are abstract "Final" with coded D.
export function isPlayed(codedState: string): boolean {
  return codedState === "F" || codedState === "O";
}

// Later is more advanced. Unknown states (e.g. suspended, cancelled) rank lowest.
const STATE_RANK: Record<string, number> = { S: 1, P: 2, I: 3, M: 3, N: 3, O: 4, F: 4 };

function record(side: ScheduleGame["teams"]["home"]): string | null {
  const r = side.leagueRecord;
  return r ? `${r.wins}-${r.losses}` : null;
}

function toRow(g: ScheduleGame): GameRow {
  const ls = g.linescore;
  const { home, away } = g.teams;
  return {
    gamePk: g.gamePk,
    season: Number(g.season),
    officialDate: g.officialDate,
    gameType: g.gameType,
    gameNumber: g.gameNumber,
    abstractState: g.status.abstractGameState,
    codedState: g.status.codedGameState,
    detailedState: g.status.detailedState,
    homeTeamId: home.team.id,
    awayTeamId: away.team.id,
    homeScore: ls?.teams?.home?.runs ?? home.score ?? null,
    awayScore: ls?.teams?.away?.runs ?? away.score ?? null,
    inning: ls?.currentInning ?? null,
    inningHalf: ls?.inningHalf ?? null,
    startUtc: new Date(g.gameDate).toISOString(),
    venueName: g.venue?.name ?? null,
    homeRecord: record(home),
    awayRecord: record(away),
  };
}

// Flattens the schedule to one row per gamePk.
//
// A game can appear under two schedule dates. A postponed game keeps a coded-D
// entry on its original date and gets a second entry on its makeup date; a
// suspended game has an entry on the day it started and the day it resumed. In
// both cases the entry under the later schedule date reflects what actually
// happened, so it wins. Ties (not seen in practice) go to the more advanced state.
export function parseSchedule(json: ScheduleResponse): GameRow[] {
  const best = new Map<number, { date: string; row: GameRow }>();
  for (const { date, games } of json.dates ?? []) {
    for (const game of games) {
      const row = toRow(game);
      const prev = best.get(row.gamePk);
      if (
        !prev ||
        date > prev.date ||
        (date === prev.date &&
          (STATE_RANK[row.codedState] ?? 0) > (STATE_RANK[prev.row.codedState] ?? 0))
      ) {
        best.set(row.gamePk, { date, row });
      }
    }
  }
  return [...best.values()].map((v) => v.row);
}

export type GameDiff = {
  changed: GameRow[]; // new, or a status/score/inning field differs
  newlyFinal: GameRow[]; // played now, and previously missing or not played
  dirty: GameRow[]; // any column differs; superset of changed
};

// Pure: compares fetched rows against what the table holds.
export function diffGames(prev: Map<number, GameRow>, next: GameRow[]): GameDiff {
  const out: GameDiff = { changed: [], newlyFinal: [], dirty: [] };
  for (const row of next) {
    const old = prev.get(row.gamePk);
    if (!old || LIVE_FIELDS.some((k) => old[k] !== row[k])) out.changed.push(row);
    if (!old || COLUMNS.some(([k]) => old[k] !== row[k])) out.dirty.push(row);
    if (isPlayed(row.codedState) && !(old && isPlayed(old.codedState))) out.newlyFinal.push(row);
  }
  return out;
}

async function readGames(conn: DuckDBConnection, pks: number[]): Promise<Map<number, GameRow>> {
  if (!pks.every(Number.isInteger)) throw new Error("gamePk must be an integer");
  const select = COLUMNS.map(([key, col, type]) => {
    if (type === "DATE") return `strftime(${col}, '%Y-%m-%d') AS "${key}"`;
    if (type === "TIMESTAMPTZ") return `epoch_ms(${col}) AS "${key}"`;
    return `${col} AS "${key}"`;
  }).join(", ");
  const reader = await conn.runAndReadAll(
    `SELECT ${select} FROM games WHERE game_pk IN (${pks.join(",")})`,
  );
  const out = new Map<number, GameRow>();
  for (const r of reader.getRowObjectsJS()) {
    const row = { ...r, startUtc: new Date(Number(r.startUtc)).toISOString() } as GameRow;
    out.set(row.gamePk, row);
  }
  return out;
}

async function writeGames(conn: DuckDBConnection, rows: GameRow[]) {
  const cols = COLUMNS.map(([, col]) => col).join(", ");
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const values: DuckDBValue[] = [];
    const tuples = chunk.map((row) => {
      const slots = COLUMNS.map(([key, , type]) => {
        values.push(row[key]);
        return `$${values.length}::${type}`;
      });
      return `(${slots.join(", ")}, now())`;
    });
    await conn.run(
      `INSERT OR REPLACE INTO games (${cols}, updated_at) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
}

// Reads existing rows once, then writes only rows that differ.
export async function upsertGames(
  conn: DuckDBConnection,
  rows: GameRow[],
): Promise<{ changed: GameRow[]; newlyFinal: GameRow[] }> {
  if (rows.length === 0) return { changed: [], newlyFinal: [] };
  const prev = await readGames(
    conn,
    rows.map((r) => r.gamePk),
  );
  const { changed, newlyFinal, dirty } = diffGames(prev, rows);
  if (dirty.length > 0) await writeGames(conn, dirty);
  return { changed, newlyFinal };
}

export function toScoreUpdate(row: GameRow): ScoreUpdate {
  return {
    gamePk: row.gamePk,
    officialDate: row.officialDate,
    abstractState: row.abstractState,
    codedState: row.codedState,
    detailedState: row.detailedState,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    inning: row.inning,
    inningHalf: row.inningHalf,
  };
}
