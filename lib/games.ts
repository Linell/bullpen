import "server-only";
import { connection } from "next/server";
import { readRows } from "@/lib/db";
import { isCompleted } from "@/lib/schedule";
import { postseasonLabel, score, toStatus, type Game, type Team } from "@/lib/scoreboard";

export type GameQueryRow = {
  game_pk: number;
  season: number;
  official_date: string;
  game_type: string;
  game_number: number;
  double_header: string | null;
  rescheduled_from: string | null;
  abstract_state: string;
  coded_state: string;
  detailed_state: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  inning: number | null;
  inning_half: string | null;
  outs: number | null;
  on_first: boolean;
  on_second: boolean;
  on_third: boolean;
  start_ms: number;
  venue_name: string | null;
  home_record: string | null;
  away_record: string | null;
  home_name: string | null;
  home_abbr: string | null;
  away_name: string | null;
  away_abbr: string | null;
};

const GAME_COLUMNS = `
  g.game_pk, g.season, strftime(g.official_date, '%Y-%m-%d') AS official_date, g.game_type, g.game_number,
  g.double_header, strftime(g.rescheduled_from, '%Y-%m-%d') AS rescheduled_from,
  g.abstract_state, g.coded_state, g.detailed_state, g.home_team_id, g.away_team_id,
  g.home_score, g.away_score, g.inning, g.inning_half, g.venue_name, g.home_record, g.away_record,
  g.outs, g.on_first, g.on_second, g.on_third,
  epoch_ms(g.start_utc)::DOUBLE AS start_ms`;

export const GAMES_SELECT = `
  WITH t AS (
    SELECT team_id, team_name, abbreviation FROM teams
    QUALIFY row_number() OVER (PARTITION BY team_id ORDER BY season DESC) = 1
  )
  SELECT ${GAME_COLUMNS},
    h.team_name AS home_name, h.abbreviation AS home_abbr,
    a.team_name AS away_name, a.abbreviation AS away_abbr
  FROM games g
  LEFT JOIN t h ON h.team_id = g.home_team_id
  LEFT JOIN t a ON a.team_id = g.away_team_id`;

const GAMES_QUERY = `${GAMES_SELECT}
  WHERE g.official_date = $date::DATE
  ORDER BY g.start_utc, g.game_number, g.game_pk`;

function team(id: number, name: string | null, abbr: string | null, record: string | null): Team {
  return {
    name: name ?? `Team ${id}`,
    abbreviation: abbr ?? String(id),
    record: record ?? undefined,
  };
}

function makeupOf(rescheduledFrom: string | null, officialDate: string) {
  return rescheduledFrom && rescheduledFrom !== officialDate ? rescheduledFrom : undefined;
}

export function toGame(r: GameQueryRow): Game {
  const status = toStatus({
    abstractState: r.abstract_state,
    codedState: r.coded_state,
    detailedState: r.detailed_state,
    inning: r.inning,
    inningHalf: r.inning_half,
    outs: r.outs,
    bases: [r.on_first, r.on_second, r.on_third],
  });
  return {
    id: String(r.game_pk),
    gamePk: r.game_pk,
    officialDate: r.official_date,
    gameNumber: r.game_number,
    doubleHeader: r.double_header === "Y" || r.double_header === "S",
    makeupOf: makeupOf(r.rescheduled_from, r.official_date),
    postseason: postseasonLabel(r.game_type),
    startTime: new Date(r.start_ms).toISOString(),
    venue: r.venue_name ?? undefined,
    status,
    completed: isCompleted(r.coded_state),
    away: {
      team: team(r.away_team_id, r.away_name, r.away_abbr, r.away_record),
      score: score(status, r.away_score),
    },
    home: {
      team: team(r.home_team_id, r.home_name, r.home_abbr, r.home_record),
      score: score(status, r.home_score),
    },
  };
}

export async function getGames(date: string): Promise<Game[]> {
  await connection();
  const rows = await readRows<GameQueryRow>(GAMES_QUERY, { date });
  return rows.map(toGame);
}
