import type { Game } from "@/lib/scoreboard";

export type TeamResult = {
  gamePk: number;
  officialDate: string;
  won: boolean;
  home: boolean;
  opponent: string;
  runsFor: number;
  runsAgainst: number;
};

export type Form = {
  results: TeamResult[];
  streak?: string;
};

export type SeriesRecord = {
  awayWins: number;
  homeWins: number;
};

export function toResult(game: Game, home: boolean): TeamResult {
  const side = home ? game.home : game.away;
  const other = home ? game.away : game.home;
  const runsFor = side.score ?? 0;
  const runsAgainst = other.score ?? 0;
  return {
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    won: runsFor > runsAgainst,
    home,
    opponent: other.team.abbreviation,
    runsFor,
    runsAgainst,
  };
}

export function streak(results: TeamResult[]): string | undefined {
  const [latest] = results;
  if (!latest) return undefined;
  const length = results.findIndex((r) => r.won !== latest.won);
  return `${latest.won ? "W" : "L"}${length === -1 ? results.length : length}`;
}

export function seriesRecord(awayResults: TeamResult[]): SeriesRecord {
  const awayWins = awayResults.filter((r) => r.won).length;
  return { awayWins, homeWins: awayResults.length - awayWins };
}
