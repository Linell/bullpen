import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { GAMES_TAG, gameTag, teamTag } from "@/lib/cache-tags";
import { formatInnings } from "@/lib/format";
import type { PlayerRef } from "@/lib/player-ref";
import { isCompleted } from "@/lib/schedule";

export type Decision = "W" | "L" | "S" | "H" | "BS";

export type BattingLine = {
  player: PlayerRef;
  position?: string;
  isSubstitute: boolean;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  walks: number;
  strikeouts: number;
};

export type PitchingLine = {
  player: PlayerRef;
  innings: string;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
  pitches: number;
  decision?: Decision;
};

export type TeamBoxScore = { batting: BattingLine[]; pitching: PitchingLine[] };

export type BoxScore = { away: TeamBoxScore; home: TeamBoxScore };

type Side = "away" | "home";

type BattingRow = {
  side: Side;
  player_id: number;
  name: string;
  position: string | null;
  is_substitute: boolean | null;
  at_bats: number;
  runs: number;
  hits: number;
  rbi: number;
  walks: number;
  strikeouts: number;
};

type PitchingRow = {
  side: Side;
  player_id: number;
  name: string;
  outs: number;
  hits: number;
  runs: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  home_runs: number;
  pitches: number;
  is_win: boolean;
  is_loss: boolean;
  is_save: boolean;
  is_hold: boolean;
  is_blown_save: boolean;
};

type GameRow = {
  home_team_id: number;
  away_team_id: number;
  coded_state: string;
};

const GAME_QUERY = `
  SELECT home_team_id, away_team_id, coded_state
  FROM games
  WHERE game_pk = $gamePk::INTEGER`;

const BATTING_QUERY = `
  SELECT gp.side::VARCHAR AS side, b.player_id,
    coalesce(p.boxscore_name, p.full_name, 'Player ' || b.player_id::VARCHAR) AS name,
    gp.position, gp.is_substitute,
    b.at_bats, b.runs, b.hits, b.rbi, b.walks, b.strikeouts
  FROM player_game_batting b
  JOIN game_players gp ON gp.game_pk = b.game_pk AND gp.player_id = b.player_id AND gp.team_id = b.team_id
  LEFT JOIN players p ON p.player_id = b.player_id
  WHERE b.game_pk = $gamePk::INTEGER
  ORDER BY gp.batting_order NULLS LAST, b.player_id`;

const PITCHING_QUERY = `
  WITH first_seen AS (
    SELECT pitcher_id, min(at_bat_index) AS at_bat_index
    FROM plays
    WHERE game_pk = $gamePk::INTEGER
    GROUP BY pitcher_id
  )
  SELECT CASE WHEN pi.team_id = g.home_team_id THEN 'home' ELSE 'away' END AS side, pi.player_id,
    coalesce(p.boxscore_name, p.full_name, 'Player ' || pi.player_id::VARCHAR) AS name,
    pi.outs, pi.hits, pi.runs, pi.earned_runs, pi.walks, pi.strikeouts, pi.home_runs, pi.pitches,
    pi.is_win, pi.is_loss, pi.is_save, pi.is_hold, pi.is_blown_save
  FROM player_game_pitching pi
  JOIN games g ON g.game_pk = pi.game_pk
  LEFT JOIN players p ON p.player_id = pi.player_id
  LEFT JOIN first_seen fs ON fs.pitcher_id = pi.player_id
  WHERE pi.game_pk = $gamePk::INTEGER
  ORDER BY pi.is_starter DESC, fs.at_bat_index NULLS LAST, pi.player_id`;

function toBattingLine(row: BattingRow): BattingLine {
  return {
    player: { id: row.player_id, name: row.name },
    position: row.position ?? undefined,
    isSubstitute: row.is_substitute ?? false,
    atBats: row.at_bats,
    runs: row.runs,
    hits: row.hits,
    rbi: row.rbi,
    walks: row.walks,
    strikeouts: row.strikeouts,
  };
}

function toDecision(row: PitchingRow): Decision | undefined {
  if (row.is_win) return "W";
  if (row.is_loss) return "L";
  if (row.is_save) return "S";
  if (row.is_blown_save) return "BS";
  if (row.is_hold) return "H";
  return undefined;
}

function toPitchingLine(row: PitchingRow): PitchingLine {
  return {
    player: { id: row.player_id, name: row.name },
    innings: formatInnings(row.outs / 3),
    hits: row.hits,
    runs: row.runs,
    earnedRuns: row.earned_runs,
    walks: row.walks,
    strikeouts: row.strikeouts,
    homeRuns: row.home_runs,
    pitches: row.pitches,
    decision: toDecision(row),
  };
}

function toTeam(batting: BattingRow[], pitching: PitchingRow[], side: Side): TeamBoxScore {
  return {
    batting: batting.filter((r) => r.side === side).map(toBattingLine),
    pitching: pitching.filter((r) => r.side === side).map(toPitchingLine),
  };
}

export async function getBoxScore(gamePk: number): Promise<BoxScore | undefined> {
  "use cache: remote";
  const params = { gamePk };
  const [[game], batting, pitching] = await Promise.all([
    readRows<GameRow>(GAME_QUERY, params),
    readRows<BattingRow>(BATTING_QUERY, params),
    readRows<PitchingRow>(PITCHING_QUERY, params),
  ]);
  if (!game) {
    cacheLife("minutes");
    return undefined;
  }

  cacheTag(gameTag(gamePk), teamTag(game.home_team_id), teamTag(game.away_team_id), GAMES_TAG);
  if (isCompleted(game.coded_state)) cacheLife("max");
  else cacheLife("minutes");

  if (batting.length === 0 && pitching.length === 0) return undefined;
  return { away: toTeam(batting, pitching, "away"), home: toTeam(batting, pitching, "home") };
}
