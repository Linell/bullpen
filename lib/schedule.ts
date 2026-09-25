import type { DuckDBConnection, DuckDBValue } from "@duckdb/node-api";
import type { ScheduleGame, ScheduleResponse } from "@/lib/mlb";

export type GameRow = {
  gamePk: number;
  season: number;
  officialDate: string;
  gameType: string;
  gameNumber: number;
  doubleHeader: string | null;
  rescheduledFrom: string | null;
  abstractState: string;
  codedState: string;
  detailedState: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  inning: number | null;
  inningHalf: string | null;
  outs: number | null;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  startUtc: string;
  venueName: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  homeProbableId: number | null;
  homeProbableName: string | null;
  awayProbableId: number | null;
  awayProbableName: string | null;
};

const COLUMNS = [
  ["gamePk", "game_pk", "INTEGER"],
  ["season", "season", "INTEGER"],
  ["officialDate", "official_date", "DATE"],
  ["gameType", "game_type", "VARCHAR"],
  ["gameNumber", "game_number", "INTEGER"],
  ["doubleHeader", "double_header", "VARCHAR"],
  ["rescheduledFrom", "rescheduled_from", "DATE"],
  ["abstractState", "abstract_state", "VARCHAR"],
  ["codedState", "coded_state", "VARCHAR"],
  ["detailedState", "detailed_state", "VARCHAR"],
  ["homeTeamId", "home_team_id", "INTEGER"],
  ["awayTeamId", "away_team_id", "INTEGER"],
  ["homeScore", "home_score", "INTEGER"],
  ["awayScore", "away_score", "INTEGER"],
  ["inning", "inning", "INTEGER"],
  ["inningHalf", "inning_half", "VARCHAR"],
  ["outs", "outs", "INTEGER"],
  ["onFirst", "on_first", "BOOLEAN"],
  ["onSecond", "on_second", "BOOLEAN"],
  ["onThird", "on_third", "BOOLEAN"],
  ["startUtc", "start_utc", "TIMESTAMPTZ"],
  ["venueName", "venue_name", "VARCHAR"],
  ["homeRecord", "home_record", "VARCHAR"],
  ["awayRecord", "away_record", "VARCHAR"],
  ["homeProbableId", "home_probable_id", "INTEGER"],
  ["homeProbableName", "home_probable_name", "VARCHAR"],
  ["awayProbableId", "away_probable_id", "INTEGER"],
  ["awayProbableName", "away_probable_name", "VARCHAR"],
] as const satisfies readonly (readonly [keyof GameRow, string, string])[];

const INSERT_CHUNK = 500;

const COMPLETED_STATES = ["F", "O", "Q", "R"];

export function isCompleted(codedState: string): boolean {
  return COMPLETED_STATES.includes(codedState);
}

export function findCompletedGamePks(rows: GameRow[]): number[] {
  return rows.filter((row) => isCompleted(row.codedState)).map((row) => row.gamePk);
}

const RESCHEDULED_STATES = ["D", "T", "U"];

export function findRescheduledGamePks(rows: GameRow[]): number[] {
  return rows.filter((row) => RESCHEDULED_STATES.includes(row.codedState)).map((row) => row.gamePk);
}

export function replaceGames(rows: GameRow[], replacements: GameRow[]): GameRow[] {
  const byGamePk = new Map(replacements.map((row) => [row.gamePk, row]));
  return rows.map((row) => byGamePk.get(row.gamePk) ?? row);
}

export function findLiveGamePks(rows: GameRow[]): number[] {
  return rows
    .filter((row) => row.abstractState === "Live" && !isCompleted(row.codedState))
    .map((row) => row.gamePk);
}

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
    doubleHeader: g.doubleHeader ?? null,
    rescheduledFrom: g.rescheduledFromDate ?? null,
    abstractState: g.status.abstractGameState,
    codedState: g.status.codedGameState,
    detailedState: g.status.detailedState,
    homeTeamId: home.team.id,
    awayTeamId: away.team.id,
    homeScore: ls?.teams?.home?.runs ?? home.score ?? null,
    awayScore: ls?.teams?.away?.runs ?? away.score ?? null,
    inning: ls?.currentInning ?? null,
    inningHalf: ls?.inningHalf ?? null,
    outs: ls?.outs ?? null,
    onFirst: ls?.offense?.first != null,
    onSecond: ls?.offense?.second != null,
    onThird: ls?.offense?.third != null,
    startUtc: new Date(g.gameDate).toISOString(),
    venueName: g.venue?.name ?? null,
    homeRecord: record(home),
    awayRecord: record(away),
    homeProbableId: home.probablePitcher?.id ?? null,
    homeProbableName: home.probablePitcher?.fullName ?? null,
    awayProbableId: away.probablePitcher?.id ?? null,
    awayProbableName: away.probablePitcher?.fullName ?? null,
  };
}

export function parseSchedule(json: ScheduleResponse): GameRow[] {
  const best = new Map<number, { date: string; row: GameRow }>();
  for (const { date, games } of json.dates ?? []) {
    for (const game of games) {
      const row = toRow(game);
      const prev = best.get(row.gamePk);
      if (!prev || date > prev.date) best.set(row.gamePk, { date, row });
    }
  }
  return [...best.values()].map((v) => v.row);
}

export function changedGames(prev: Map<number, GameRow>, next: GameRow[]): GameRow[] {
  return next.filter((row) => {
    const old = prev.get(row.gamePk);
    return !old || COLUMNS.some(([k]) => old[k] !== row[k]);
  });
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

export async function upsertGames(conn: DuckDBConnection, rows: GameRow[]) {
  if (rows.length === 0) return { changed: 0, changedGamePks: [] };
  const prev = await readGames(
    conn,
    rows.map((r) => r.gamePk),
  );
  const changed = changedGames(prev, rows);
  if (changed.length > 0) await writeGames(conn, changed);
  return { changed: changed.length, changedGamePks: changed.map((row) => row.gamePk) };
}
