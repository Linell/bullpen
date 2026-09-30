import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { STATS_TAG } from "@/lib/cache-tags";
import { todayOfficialDate } from "@/lib/dates";
import {
  COMPLETED_FILTER,
  pct,
  SEASON_TEAMS,
  toTeamInfo,
  type StandingsRow,
  type TeamRow,
  type WinLoss,
} from "@/lib/team-summary";

export type TeamStanding = StandingsRow & {
  runDiff: number;
  last10: WinLoss;
  streak?: string;
};

export type DivisionStandings = {
  id: number;
  name: string;
  teams: TeamStanding[];
};

export type LeagueStandings = {
  name: string;
  divisions: DivisionStandings[];
  wildCard: TeamStanding[];
};

type StandingsQueryRow = TeamRow &
  WinLoss & {
    division_id: number;
    run_diff: number;
    form: boolean[];
  };

const LAST_GAMES = 10;
const WILD_CARD_SPOTS = 3;

const SEASONS_QUERY = `SELECT DISTINCT season FROM games ORDER BY season DESC`;

const STANDINGS_QUERY = `
  WITH ${SEASON_TEAMS},
  results AS (
    SELECT unnest([home_team_id, away_team_id]) AS team_id,
      unnest([home_score > away_score, away_score > home_score]) AS won,
      unnest([home_score - away_score, away_score - home_score]) AS run_diff,
      start_utc, game_number
    FROM games g
    WHERE g.season = $season::INTEGER AND g.game_type = 'R' AND ${COMPLETED_FILTER}
  )
  SELECT t.team_id, t.name, t.abbreviation, t.league_name, t.division_id, t.division_name,
    count(r.won) FILTER (WHERE r.won)::INTEGER AS wins,
    count(r.won) FILTER (WHERE NOT r.won)::INTEGER AS losses,
    coalesce(sum(r.run_diff), 0)::INTEGER AS run_diff,
    list(r.won ORDER BY r.start_utc DESC, r.game_number DESC) FILTER (WHERE r.won IS NOT NULL) AS form
  FROM season_teams t
  LEFT JOIN results r USING (team_id)
  WHERE t.league_name IS NOT NULL AND t.division_id IS NOT NULL
  GROUP BY ALL`;

function currentStreak(form: boolean[]) {
  const [latest] = form;
  if (latest === undefined) return undefined;
  const length = form.findIndex((won) => won !== latest);
  return `${latest ? "W" : "L"}${length === -1 ? form.length : length}`;
}

function byRecord(a: StandingsQueryRow, b: StandingsQueryRow) {
  return pct(b) - pct(a) || b.wins - a.wins || a.name.localeCompare(b.name);
}

function toStandings(rows: StandingsQueryRow[], benchmark: WinLoss): TeamStanding[] {
  return rows.map((row) => {
    const last10 = row.form.slice(0, LAST_GAMES).filter(Boolean).length;
    return {
      team: toTeamInfo(row),
      wins: row.wins,
      losses: row.losses,
      pct: pct(row),
      gamesBack: (benchmark.wins - row.wins + row.losses - benchmark.losses) / 2,
      runDiff: row.run_diff,
      last10: { wins: last10, losses: Math.min(row.form.length, LAST_GAMES) - last10 },
      streak: currentStreak(row.form),
    };
  });
}

function groupBy<T>(items: T[], key: (item: T) => string | number) {
  const groups = new Map<string | number, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.values()];
}

function toLeague(rows: StandingsQueryRow[]): LeagueStandings {
  const divisionRows = groupBy(rows, (row) => row.division_id).map((division) => division.sort(byRecord));
  const wildCardRows = divisionRows
    .flatMap((division) => division.slice(1))
    .sort(byRecord)
    .slice(0, WILD_CARD_SPOTS);
  return {
    name: rows[0].league_name!,
    divisions: divisionRows
      .map((division) => ({
        id: division[0].division_id,
        name: division[0].division_name!,
        teams: toStandings(division, division[0]),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    wildCard: toStandings(wildCardRows, wildCardRows.at(-1) ?? { wins: 0, losses: 0 }),
  };
}

function isPastSeason(season: number) {
  return season < Number(todayOfficialDate().slice(0, 4));
}

export async function getStandingsSeasons(): Promise<number[]> {
  "use cache: remote";
  const rows = await readRows<{ season: number }>(SEASONS_QUERY, {});
  cacheTag(STATS_TAG);
  cacheLife("hours");
  return rows.map((r) => r.season);
}

export async function getStandings(season: number): Promise<LeagueStandings[]> {
  "use cache: remote";
  cacheTag(STATS_TAG);
  if (isPastSeason(season)) cacheLife("max");
  else cacheLife("minutes");

  const rows = await readRows<StandingsQueryRow>(STANDINGS_QUERY, { season });
  return groupBy(rows, (row) => row.league_name!)
    .map(toLeague)
    .sort((a, b) => a.name.localeCompare(b.name));
}
