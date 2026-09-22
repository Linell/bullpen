import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { todayOfficialDate } from "@/lib/format";
import { postseasonLabel, score, toStatus, type Game, type Team } from "@/lib/scoreboard";

export type { Game, GameSide, GameStatus, Team } from "@/lib/scoreboard";

type Row = {
  game_pk: number;
  official_date: string;
  game_type: string;
  game_number: number;
  abstract_state: string;
  coded_state: string;
  detailed_state: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  inning: number | null;
  inning_half: string | null;
  start_ms: number;
  updated_ms: number;
  venue_name: string | null;
  home_record: string | null;
  away_record: string | null;
  home_name: string | null;
  home_abbr: string | null;
  away_name: string | null;
  away_abbr: string | null;
};

const GAME_COLUMNS = `
  g.game_pk, strftime(g.official_date, '%Y-%m-%d') AS official_date, g.game_type, g.game_number,
  g.abstract_state, g.coded_state, g.detailed_state, g.home_team_id, g.away_team_id,
  g.home_score, g.away_score, g.inning, g.inning_half, g.venue_name, g.home_record, g.away_record,
  epoch_ms(g.start_utc)::DOUBLE AS start_ms, epoch_ms(g.updated_at)::DOUBLE AS updated_ms`;

// Latest row per team, if the derived teams table exists yet.
const WITH_TEAMS = `
  WITH t AS (
    SELECT team_id, team_name, abbreviation FROM teams
    QUALIFY row_number() OVER (PARTITION BY team_id ORDER BY season DESC) = 1
  )
  SELECT ${GAME_COLUMNS},
    h.team_name AS home_name, h.abbreviation AS home_abbr,
    a.team_name AS away_name, a.abbreviation AS away_abbr
  FROM games g
  LEFT JOIN t h ON h.team_id = g.home_team_id
  LEFT JOIN t a ON a.team_id = g.away_team_id
  WHERE g.official_date = $date::DATE
  ORDER BY g.start_utc, g.game_number, g.game_pk`;

const WITHOUT_TEAMS = `
  SELECT ${GAME_COLUMNS},
    NULL AS home_name, NULL AS home_abbr, NULL AS away_name, NULL AS away_abbr
  FROM games g
  WHERE g.official_date = $date::DATE
  ORDER BY g.start_utc, g.game_number, g.game_pk`;

function team(id: number, name: string | null, abbr: string | null, record: string | null): Team {
  return {
    name: name ?? `Team ${id}`,
    abbreviation: abbr ?? String(id),
    record: record ?? undefined,
  };
}

function toGame(r: Row): Game {
  const status = toStatus({
    abstractState: r.abstract_state,
    codedState: r.coded_state,
    detailedState: r.detailed_state,
    inning: r.inning,
    inningHalf: r.inning_half,
  });
  return {
    id: String(r.game_pk),
    gamePk: r.game_pk,
    officialDate: r.official_date,
    gameNumber: r.game_number,
    postseason: postseasonLabel(r.game_type),
    startTime: new Date(r.start_ms).toISOString(),
    venue: r.venue_name ?? undefined,
    status,
    away: {
      team: team(r.away_team_id, r.away_name, r.away_abbr, r.away_record),
      score: score(status, r.away_score),
    },
    home: {
      team: team(r.home_team_id, r.home_name, r.home_abbr, r.home_record),
      score: score(status, r.home_score),
    },
    updatedAt: r.updated_ms,
  };
}

// Games for an MLB official date (YYYY-MM-DD), defaulting to today in Eastern time.
export async function getGames(date?: string): Promise<Game[]> {
  await connection();
  const conn = await db();
  const hasTeams = await conn.runAndReadAll(
    "SELECT 1 FROM duckdb_tables() WHERE table_name = 'teams' AND schema_name = current_schema()",
  );
  const sql = hasTeams.currentRowCount > 0 ? WITH_TEAMS : WITHOUT_TEAMS;
  const reader = await conn.runAndReadAll(sql, { date: date ?? todayOfficialDate() });
  return (reader.getRowObjectsJS() as unknown as Row[]).map(toGame);
}
