import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { dayTag, GAMES_TAG } from "@/lib/cache-tags";
import { isCompleted } from "@/lib/schedule";
import { playerRef } from "@/lib/player-ref";
import { ratio } from "@/lib/stats/rates";
import { REGULAR_GAME, REGULAR_GAMES } from "@/lib/stats/sql";
import { postseasonLabel, score, toStatus, type Game, type PitcherLine, type Series, type Team } from "@/lib/scoreboard";

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
  home_probable_id: number | null;
  home_probable_name: string | null;
  away_probable_id: number | null;
  away_probable_name: string | null;
  home_probable_wins: number | null;
  home_probable_losses: number | null;
  home_probable_earned_runs: number | null;
  home_probable_outs: number | null;
  away_probable_wins: number | null;
  away_probable_losses: number | null;
  away_probable_earned_runs: number | null;
  away_probable_outs: number | null;
  series_game_number: number | null;
  games_in_series: number | null;
  series_result: string | null;
  home_name: string | null;
  home_abbr: string | null;
  away_name: string | null;
  away_abbr: string | null;
};

const GAME_COLUMNS = `
  g.game_pk, g.season, strftime(g.official_date, '%Y-%m-%d') AS official_date, g.game_type, g.game_number,
  g.double_header, strftime(g.rescheduled_from, '%Y-%m-%d') AS rescheduled_from,
  g.abstract_state, g.coded_state, g.detailed_state, g.home_team_id, g.away_team_id,
  g.home_score, g.away_score, g.inning, g.inning_half, g.venue_name,
  CASE g.game_type WHEN 'R' THEN g.home_record ELSE hr.record END AS home_record,
  CASE g.game_type WHEN 'R' THEN g.away_record ELSE ar.record END AS away_record,
  g.home_probable_id, g.home_probable_name, g.away_probable_id, g.away_probable_name,
  g.outs, g.on_first, g.on_second, g.on_third,
  g.series_game_number, g.games_in_series, g.series_result,
  hp.wins AS home_probable_wins, hp.losses AS home_probable_losses,
  hp.earned_runs AS home_probable_earned_runs, hp.outs AS home_probable_outs,
  ap.wins AS away_probable_wins, ap.losses AS away_probable_losses,
  ap.earned_runs AS away_probable_earned_runs, ap.outs AS away_probable_outs,
  epoch_ms(g.start_utc)::DOUBLE AS start_ms`;

const FINAL_REGULAR_SEASON_RECORDS = `
  SELECT season, team_id, arg_max(record, start_utc) AS record
  FROM (
    SELECT season, home_team_id AS team_id, home_record AS record, start_utc FROM games WHERE ${REGULAR_GAME}
    UNION ALL
    SELECT season, away_team_id, away_record, start_utc FROM games WHERE ${REGULAR_GAME}
  )
  GROUP BY season, team_id`;

const PITCHER_SEASON_LINES = `
  SELECT season, player_id,
    count(*) FILTER (is_win)::INTEGER AS wins,
    count(*) FILTER (is_loss)::INTEGER AS losses,
    sum(earned_runs)::INTEGER AS earned_runs,
    sum(outs)::INTEGER AS outs
  FROM player_game_pitching
  WHERE game_pk IN (${REGULAR_GAMES})
  GROUP BY season, player_id`;

export const GAMES_SELECT = `
  SELECT ${GAME_COLUMNS},
    h.team_name AS home_name, h.abbreviation AS home_abbr,
    a.team_name AS away_name, a.abbreviation AS away_abbr
  FROM games g
  ASOF LEFT JOIN teams h ON h.team_id = g.home_team_id AND g.season >= h.season
  ASOF LEFT JOIN teams a ON a.team_id = g.away_team_id AND g.season >= a.season
  LEFT JOIN (${FINAL_REGULAR_SEASON_RECORDS}) hr ON hr.season = g.season AND hr.team_id = g.home_team_id
  LEFT JOIN (${FINAL_REGULAR_SEASON_RECORDS}) ar ON ar.season = g.season AND ar.team_id = g.away_team_id
  LEFT JOIN (${PITCHER_SEASON_LINES}) hp ON hp.season = g.season AND hp.player_id = g.home_probable_id
  LEFT JOIN (${PITCHER_SEASON_LINES}) ap ON ap.season = g.season AND ap.player_id = g.away_probable_id`;

const GAMES_QUERY = `${GAMES_SELECT}
  WHERE g.official_date = $date::DATE
  ORDER BY g.start_utc, g.game_number, g.game_pk`;

function team(id: number, name: string | null, abbr: string | null, record: string | null): Team {
  return {
    id,
    name: name ?? `Team ${id}`,
    abbreviation: abbr ?? String(id),
    record: record ?? undefined,
  };
}

function makeupOf(rescheduledFrom: string | null, officialDate: string) {
  return rescheduledFrom && rescheduledFrom !== officialDate ? rescheduledFrom : undefined;
}

function probableLine(r: GameQueryRow, side: "home" | "away"): PitcherLine | undefined {
  const wins = r[`${side}_probable_wins`];
  const losses = r[`${side}_probable_losses`];
  const earnedRuns = r[`${side}_probable_earned_runs`];
  const outs = r[`${side}_probable_outs`];
  if (wins == null || losses == null || earnedRuns == null || outs == null) return undefined;
  return { wins, losses, era: ratio(earnedRuns * 27, outs) };
}

function series(r: GameQueryRow): Series | undefined {
  if (!postseasonLabel(r.game_type) || r.series_game_number == null || r.games_in_series == null) return undefined;
  return {
    gameNumber: r.series_game_number,
    games: r.games_in_series,
    result: r.series_result ?? undefined,
  };
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
    season: r.season,
    officialDate: r.official_date,
    gameNumber: r.game_number,
    doubleHeader: r.double_header === "Y" || r.double_header === "S",
    makeupOf: makeupOf(r.rescheduled_from, r.official_date),
    postseason: postseasonLabel(r.game_type),
    series: series(r),
    startTime: new Date(r.start_ms).toISOString(),
    venue: r.venue_name ?? undefined,
    status,
    completed: isCompleted(r.coded_state),
    away: {
      team: team(r.away_team_id, r.away_name, r.away_abbr, r.away_record),
      score: score(status, r.away_score),
      probable: playerRef(r.away_probable_id, r.away_probable_name),
      probableLine: probableLine(r, "away"),
    },
    home: {
      team: team(r.home_team_id, r.home_name, r.home_abbr, r.home_record),
      score: score(status, r.home_score),
      probable: playerRef(r.home_probable_id, r.home_probable_name),
      probableLine: probableLine(r, "home"),
    },
  };
}

export async function getGames(date: string): Promise<Game[]> {
  "use cache: remote";
  const rows = await readRows<GameQueryRow>(GAMES_QUERY, { date });
  const games = rows.map(toGame);
  cacheTag(dayTag(date), GAMES_TAG);
  if (games.length > 0 && games.every((g) => g.completed)) cacheLife("max");
  else cacheLife("minutes");
  return games;
}
