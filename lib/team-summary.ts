import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { teamTag } from "@/lib/cache-tags";
import { todayOfficialDate } from "@/lib/dates";
import { GAMES_SELECT, toGame, type GameQueryRow } from "@/lib/games";
import { streak, toResult, type TeamResult } from "@/lib/matchup";
import type { Game } from "@/lib/scoreboard";

export type TeamInfo = {
  id: number;
  name: string;
  abbreviation: string;
  league?: string;
  division?: string;
};

export type WinLoss = {
  wins: number;
  losses: number;
};

export type TeamRecord = WinLoss & {
  runsScored: number;
  runsAllowed: number;
  runDiff: number;
  pythag: WinLoss;
  streak?: string;
  last10: WinLoss;
};

export type StandingsRow = WinLoss & {
  team: TeamInfo;
  pct: number;
  gamesBack: number;
};

export type TeamSummary = {
  team: TeamInfo;
  season: number;
  record: TeamRecord;
  recentGames: Game[];
  upcomingGames: Game[];
  standings: StandingsRow[];
};

type TeamRow = {
  team_id: number;
  name: string;
  abbreviation: string | null;
  league_name: string | null;
  division_name: string | null;
};

type StandingsQueryRow = TeamRow & WinLoss;

const GAME_LIMIT = 10;
const PYTHAG_EXPONENT = 1.83;

const COMPLETED_FILTER = `g.coded_state IN ('F', 'O', 'Q', 'R')`;

const TEAM_GAME_FILTER = `g.season = $season::INTEGER AND $teamId::INTEGER IN (g.home_team_id, g.away_team_id)`;

const SEASONS_QUERY = `
  SELECT DISTINCT season FROM games
  WHERE $teamId::INTEGER IN (home_team_id, away_team_id)
  ORDER BY season DESC`;

const TEAM_QUERY = `
  SELECT team_id, name, abbreviation, league_name, division_name
  FROM teams
  WHERE team_id = $teamId::INTEGER`;

const COMPLETED_QUERY = `${GAMES_SELECT}
  WHERE ${TEAM_GAME_FILTER} AND ${COMPLETED_FILTER}
  ORDER BY g.start_utc DESC, g.game_number DESC`;

const UPCOMING_QUERY = `${GAMES_SELECT}
  WHERE ${TEAM_GAME_FILTER} AND g.abstract_state <> 'Final'
  ORDER BY g.start_utc, g.game_number
  LIMIT ${GAME_LIMIT}`;

const STANDINGS_QUERY = `
  WITH members AS (
    SELECT team_id, name, abbreviation, league_name, division_name FROM teams
    WHERE division_id = (SELECT division_id FROM teams WHERE team_id = $teamId::INTEGER)
  ),
  results AS (
    SELECT unnest([home_team_id, away_team_id]) AS team_id,
      unnest([home_score > away_score, away_score > home_score]) AS won
    FROM games g
    WHERE g.season = $season::INTEGER AND g.game_type = 'R' AND ${COMPLETED_FILTER}
  )
  SELECT m.*,
    count(*) FILTER (WHERE r.won)::INTEGER AS wins,
    count(*) FILTER (WHERE NOT r.won)::INTEGER AS losses
  FROM members m
  LEFT JOIN results r USING (team_id)
  GROUP BY ALL
  ORDER BY wins - losses DESC, wins DESC, m.name`;

function toTeamInfo(row: TeamRow): TeamInfo {
  return {
    id: row.team_id,
    name: row.name,
    abbreviation: row.abbreviation ?? String(row.team_id),
    league: row.league_name ?? undefined,
    division: row.division_name ?? undefined,
  };
}

function winLoss(results: TeamResult[]): WinLoss {
  const wins = results.filter((r) => r.won).length;
  return { wins, losses: results.length - wins };
}

function pythag(runsScored: number, runsAllowed: number, games: number): WinLoss {
  const scored = runsScored ** PYTHAG_EXPONENT;
  const allowed = runsAllowed ** PYTHAG_EXPONENT;
  const wins = scored + allowed > 0 ? Math.round((games * scored) / (scored + allowed)) : 0;
  return { wins, losses: games - wins };
}

function toRecord(results: TeamResult[]): TeamRecord {
  const runsScored = results.reduce((sum, r) => sum + r.runsFor, 0);
  const runsAllowed = results.reduce((sum, r) => sum + r.runsAgainst, 0);
  return {
    ...winLoss(results),
    runsScored,
    runsAllowed,
    runDiff: runsScored - runsAllowed,
    pythag: pythag(runsScored, runsAllowed, results.length),
    streak: streak(results),
    last10: winLoss(results.slice(0, GAME_LIMIT)),
  };
}

function pct({ wins, losses }: WinLoss) {
  return wins + losses > 0 ? wins / (wins + losses) : 0;
}

function toStandings(rows: StandingsQueryRow[]): StandingsRow[] {
  const [leader] = rows;
  return rows.map((row) => ({
    team: toTeamInfo(row),
    wins: row.wins,
    losses: row.losses,
    pct: pct(row),
    gamesBack: (leader.wins - row.wins + row.losses - leader.losses) / 2,
  }));
}

function isPastSeason(season: number) {
  return season < Number(todayOfficialDate().slice(0, 4));
}

export async function getTeamSeasons(teamId: number): Promise<number[]> {
  "use cache: remote";
  const rows = await readRows<{ season: number }>(SEASONS_QUERY, { teamId });
  cacheTag(teamTag(teamId));
  cacheLife("hours");
  return rows.map((r) => r.season);
}

export async function getTeamSummary(teamId: number, season: number): Promise<TeamSummary | undefined> {
  "use cache: remote";
  cacheTag(teamTag(teamId));
  const past = isPastSeason(season);
  if (past) cacheLife("max");
  else cacheLife("minutes");

  const params = { teamId, season };
  const [[team], completed, upcoming, standings] = await Promise.all([
    readRows<TeamRow>(TEAM_QUERY, { teamId }),
    readRows<GameQueryRow>(COMPLETED_QUERY, params),
    past ? Promise.resolve([]) : readRows<GameQueryRow>(UPCOMING_QUERY, params),
    readRows<StandingsQueryRow>(STANDINGS_QUERY, params),
  ]);
  if (!team) return undefined;

  const regularSeason = completed
    .filter((r) => r.game_type === "R")
    .map((r) => toResult(toGame(r), r.home_team_id === teamId));
  return {
    team: toTeamInfo(team),
    season,
    record: toRecord(regularSeason),
    recentGames: completed.slice(0, GAME_LIMIT).map(toGame),
    upcomingGames: upcoming.map(toGame),
    standings: toStandings(standings),
  };
}
