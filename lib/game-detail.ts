import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { readRows } from "@/lib/db";
import { GAMES_SELECT, toGame, type GameQueryRow } from "@/lib/games";
import { toLinescore, type Linescore, type LinescoreRow } from "@/lib/linescore";
import { toHalfInnings, type HalfInning, type PlayRow, type StepRow } from "@/lib/play-by-play";
import type { Game } from "@/lib/scoreboard";

export type Decisions = {
  winner: string;
  loser?: string;
  save?: string;
};

export type GameDetail = {
  game: Game;
  decisions?: Decisions;
  linescore?: Linescore;
  halfInnings: HalfInning[];
};

type GameWithDecisionsRow = GameQueryRow & {
  winner: string | null;
  loser: string | null;
  save: string | null;
};

const GAME_QUERY = `
  SELECT game.*, w.full_name AS winner, l.full_name AS loser, s.full_name AS save
  FROM (${GAMES_SELECT} WHERE g.game_pk = $gamePk::INTEGER) game
  LEFT JOIN game_decisions d USING (game_pk)
  LEFT JOIN players w ON w.player_id = d.winner_id
  LEFT JOIN players l ON l.player_id = d.loser_id
  LEFT JOIN players s ON s.player_id = d.save_id`;

const LINESCORE_QUERY = `
  SELECT inning, half::VARCHAR AS half, runs, hits, errors
  FROM linescores
  WHERE game_pk = $gamePk::INTEGER`;

const PLAYS_QUERY = `
  SELECT p.at_bat_index, p.inning, p.half::VARCHAR AS half,
    coalesce(b.boxscore_name, b.full_name, 'Player ' || p.batter_id::VARCHAR) AS batter_name,
    coalesce(m.boxscore_name, m.full_name, 'Player ' || p.pitcher_id::VARCHAR) AS pitcher_name,
    p.description, p.is_scoring_play, p.away_score_after, p.home_score_after
  FROM plays p
  LEFT JOIN players b ON b.player_id = p.batter_id
  LEFT JOIN players m ON m.player_id = p.pitcher_id
  WHERE p.game_pk = $gamePk::INTEGER
  ORDER BY p.at_bat_index`;

const STEPS_QUERY = `
  SELECT 'pitch' AS kind, at_bat_index, pitch_index AS step_index, pitch_number, balls_before,
    strikes_before, pitch_type_desc, start_speed, call_desc, is_in_play, is_strike, plate_x, plate_z,
    sz_top, sz_bottom, abs_challenged, abs_overturned
  FROM pitches
  WHERE game_pk = $gamePk::INTEGER
  UNION ALL BY NAME
  SELECT kind, at_bat_index, event_index AS step_index, event_type, description
  FROM play_events
  WHERE game_pk = $gamePk::INTEGER
  ORDER BY at_bat_index, step_index`;

function toDecisions(row: GameWithDecisionsRow): Decisions | undefined {
  if (!row.winner) return undefined;
  return { winner: row.winner, loser: row.loser ?? undefined, save: row.save ?? undefined };
}

export const getGameDetail = cache(async (gamePk: number): Promise<GameDetail | undefined> => {
  await connection();
  const params = { gamePk };
  const [[row], linescore, plays, steps] = await Promise.all([
    readRows<GameWithDecisionsRow>(GAME_QUERY, params),
    readRows<LinescoreRow>(LINESCORE_QUERY, params),
    readRows<PlayRow>(PLAYS_QUERY, params),
    readRows<StepRow>(STEPS_QUERY, params),
  ]);
  if (!row) return undefined;

  const game = toGame(row);
  return {
    game,
    decisions: toDecisions(row),
    linescore: linescore.length > 0 ? toLinescore(linescore, game.completed) : undefined,
    halfInnings: toHalfInnings(plays, steps),
  };
});
