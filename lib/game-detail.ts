import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { readRows } from "@/lib/db";
import { GAMES_SELECT, toGame, type GameQueryRow } from "@/lib/games";
import {
  seriesRecord,
  streak,
  toResult,
  type Form,
  type SeriesRecord,
  type TeamResult,
} from "@/lib/matchup";
import { toLinescore, type Linescore, type LinescoreRow } from "@/lib/linescore";
import { toHalfInnings, type HalfInning, type PlayRow, type StepRow } from "@/lib/play-by-play";
import type { Game } from "@/lib/scoreboard";

export type Decisions = {
  winner: string;
  loser?: string;
  save?: string;
};

export type Starter = {
  name?: string;
  hand?: string;
  wins: number;
  losses: number;
  starts: number;
  strikeouts: number;
};

export type GameDetail = {
  game: Game;
  decisions?: Decisions;
  linescore?: Linescore;
  halfInnings: HalfInning[];
  awayForm: Form;
  homeForm: Form;
  headToHead: { record: SeriesRecord; results: TeamResult[] };
  starters: { away: Starter; home: Starter };
};

type GameWithDecisionsRow = GameQueryRow & {
  winner: string | null;
  loser: string | null;
  save: string | null;
};

type FormRow = GameQueryRow & { team_id: number };

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
    p.pitcher_id,
    coalesce(m.boxscore_name, m.full_name, 'Player ' || p.pitcher_id::VARCHAR) AS pitcher_name,
    coalesce(m.last_name, m.full_name, 'Player ' || p.pitcher_id::VARCHAR) AS pitcher_last_name,
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

const COMPLETED_FILTER = `g.coded_state IN ('F', 'O', 'Q', 'R')`;

const FORM_QUERY = `
  SELECT s.team_id, game.*
  FROM (${GAMES_SELECT} WHERE ${COMPLETED_FILTER}) game
  JOIN (
    SELECT unnest([home_team_id, away_team_id]) AS team_id, season, epoch_ms(start_utc)::DOUBLE AS start_ms
    FROM games
    WHERE game_pk = $gamePk::INTEGER
  ) s ON s.team_id IN (game.home_team_id, game.away_team_id) AND game.season = s.season AND game.start_ms < s.start_ms
  QUALIFY row_number() OVER (PARTITION BY s.team_id ORDER BY game.start_ms DESC) <= 10
  ORDER BY game.start_ms DESC`;

const HEAD_TO_HEAD_QUERY = `${GAMES_SELECT}
  JOIN games cur ON cur.game_pk = $gamePk::INTEGER
  WHERE ${COMPLETED_FILTER}
    AND g.game_pk <> cur.game_pk
    AND g.season = cur.season
    AND least(g.home_team_id, g.away_team_id) = least(cur.home_team_id, cur.away_team_id)
    AND greatest(g.home_team_id, g.away_team_id) = greatest(cur.home_team_id, cur.away_team_id)
  ORDER BY g.start_utc DESC`;

const STARTERS_QUERY = `
  WITH cur AS (SELECT * FROM games WHERE game_pk = $gamePk::INTEGER),
  probables AS (
    SELECT 'away' AS side, away_probable_id AS probable_id, away_probable_name AS probable_name FROM cur
    UNION ALL
    SELECT 'home', home_probable_id, home_probable_name FROM cur
  ),
  sides AS (
    SELECT pr.*, coalesce(st.pitcher_id, pr.probable_id) AS pitcher_id
    FROM probables pr
    LEFT JOIN game_starters st ON st.game_pk = $gamePk::INTEGER AND st.side::VARCHAR = pr.side
  ),
  prior AS (
    SELECT g.game_pk FROM games g, cur
    WHERE g.season = cur.season AND g.start_utc < cur.start_utc
  )
  SELECT sides.side,
    coalesce(p.boxscore_name, p.full_name, CASE WHEN sides.pitcher_id = sides.probable_id THEN sides.probable_name END) AS name,
    p.pitch_hand::VARCHAR AS hand,
    (SELECT count(*) FROM game_decisions d JOIN prior USING (game_pk) WHERE d.winner_id = sides.pitcher_id)::INTEGER AS wins,
    (SELECT count(*) FROM game_decisions d JOIN prior USING (game_pk) WHERE d.loser_id = sides.pitcher_id)::INTEGER AS losses,
    (SELECT count(*) FROM game_starters st JOIN prior USING (game_pk) WHERE st.pitcher_id = sides.pitcher_id)::INTEGER AS starts,
    (SELECT count(*) FROM plays pl JOIN prior USING (game_pk)
      WHERE pl.pitcher_id = sides.pitcher_id AND pl.event_type LIKE 'strikeout%')::INTEGER AS strikeouts
  FROM sides
  LEFT JOIN players p ON p.player_id = sides.pitcher_id`;

type StarterRow = {
  side: "home" | "away";
  name: string | null;
  hand: string | null;
  wins: number;
  losses: number;
  starts: number;
  strikeouts: number;
};

function toStarter(rows: StarterRow[], side: StarterRow["side"]): Starter {
  const row = rows.find((r) => r.side === side);
  return {
    name: row?.name ?? undefined,
    hand: row?.hand ?? undefined,
    wins: row?.wins ?? 0,
    losses: row?.losses ?? 0,
    starts: row?.starts ?? 0,
    strikeouts: row?.strikeouts ?? 0,
  };
}

function toForm(rows: FormRow[], teamId: number): Form {
  const results = rows
    .filter((r) => r.team_id === teamId)
    .map((r) => toResult(toGame(r), r.home_team_id === teamId));
  return { results, streak: streak(results) };
}

function toDecisions(row: GameWithDecisionsRow): Decisions | undefined {
  if (!row.winner) return undefined;
  return { winner: row.winner, loser: row.loser ?? undefined, save: row.save ?? undefined };
}

export const getGameDetail = cache(async (gamePk: number): Promise<GameDetail | undefined> => {
  await connection();
  const params = { gamePk };
  const [[row], linescore, plays, steps, form, meetings, starters] = await Promise.all([
    readRows<GameWithDecisionsRow>(GAME_QUERY, params),
    readRows<LinescoreRow>(LINESCORE_QUERY, params),
    readRows<PlayRow>(PLAYS_QUERY, params),
    readRows<StepRow>(STEPS_QUERY, params),
    readRows<FormRow>(FORM_QUERY, params),
    readRows<GameQueryRow>(HEAD_TO_HEAD_QUERY, params),
    readRows<StarterRow>(STARTERS_QUERY, params),
  ]);
  if (!row) return undefined;

  const game = toGame(row);
  const headToHead = meetings.map((r) => toResult(toGame(r), r.home_team_id === row.away_team_id));
  return {
    game,
    decisions: toDecisions(row),
    linescore: linescore.length > 0 ? toLinescore(linescore, game.completed) : undefined,
    halfInnings: toHalfInnings(plays, steps),
    awayForm: toForm(form, row.away_team_id),
    homeForm: toForm(form, row.home_team_id),
    headToHead: { record: seriesRecord(headToHead), results: headToHead },
    starters: { away: toStarter(starters, "away"), home: toStarter(starters, "home") },
  };
});
