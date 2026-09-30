import { COMPLETED_STATES_SQL } from "../schedule.ts";

export const COMPLETED_REGULAR_GAME = `game_type = 'R' AND coded_state IN (${COMPLETED_STATES_SQL})`;

export const TRACKED_GAME = `game_type IN ('R', 'F', 'D', 'L', 'W')`;

export const TRACKED_SEASON = `season = $season::INTEGER AND ${TRACKED_GAME}`;

export const TRACKED_GAMES = `SELECT game_pk FROM games WHERE ${TRACKED_GAME}`;

export const TRACKED_SEASON_GAMES = `SELECT game_pk FROM games WHERE ${TRACKED_SEASON}`;

export const BATTER_SPLITS = `unnest([
  'all',
  'vs_' || pitch_hand::VARCHAR,
  CASE half WHEN 'bottom' THEN 'home' ELSE 'away' END,
  CASE WHEN men_on_base IN ('RISP', 'Loaded') THEN 'risp' WHEN men_on_base = 'Empty' THEN 'bases_empty' END
])`;

export const BATTED_BALL_TOTALS = `
  count(launch_speed) AS batted_balls,
  count(*) FILTER (launch_speed >= 95) AS hard_hits,
  count(*) FILTER (is_barrel(launch_speed, launch_angle)) AS barrels`;

export const BATTED_BALL_COUNTS = `${BATTED_BALL_TOTALS},
  avg(launch_speed) AS exit_velocity`;

export const BATTING_COUNTS = `
  count(*) AS plate_appearances,
  count(*) FILTER (is_at_bat) AS at_bats,
  count(*) FILTER (bases > 0) AS hits,
  sum(bases) AS total_bases,
  count(*) FILTER (bases = 4) AS home_runs,
  count(*) FILTER (is_walk) AS walks,
  count(*) FILTER (event_type = 'hit_by_pitch') AS hit_by_pitch,
  count(*) FILTER (event_type LIKE 'sac_fly%') AS sac_flies,
  count(*) FILTER (is_strikeout) AS strikeouts,${BATTED_BALL_COUNTS}`;

export const BOX_BATTING_COUNTS = `
  sum(plate_appearances) AS plate_appearances,
  sum(at_bats) AS at_bats,
  sum(hits) AS hits,
  sum(total_bases) AS total_bases,
  sum(home_runs) AS home_runs,
  sum(walks) AS walks,
  sum(hit_by_pitch) AS hit_by_pitch,
  sum(sac_flies) AS sac_flies,
  sum(strikeouts) AS strikeouts`;

export const SWING_DECISION_COUNTS = `
  count(*) FILTER (NOT is_in_zone) AS out_of_zone_pitches,
  count(*) FILTER (NOT is_in_zone AND is_swing) AS chases,
  count(*) FILTER (is_in_zone AND is_swing) AS zone_swings,
  count(*) FILTER (is_in_zone AND is_swing AND NOT is_whiff) AS zone_contacts`;

export const PITCH_TOTALS = `
  count(*) AS pitches,
  count(*) FILTER (is_swing) AS swings,
  count(*) FILTER (is_whiff) AS whiffs,
  count(*) FILTER (is_called_strike) AS called_strikes`;

export const PITCH_COUNTS = `${PITCH_TOTALS},
  avg(start_speed) FILTER (is_fastball) AS fastball_velocity`;

export const PITCH_MIX_COUNTS = `
  pitch_type,
  any_value(pitch_type_desc) AS description,
  count(*) AS pitches,
  sum(count(*)) OVER () AS all_pitches,
  count(*) FILTER (is_swing) AS swings,
  count(*) FILTER (is_whiff) AS whiffs,
  avg(start_speed) AS velocity`;

export const PITCHING_COUNTS = `
  sum(batters_faced) AS batters_faced,
  sum(outs) AS outs,
  sum(runs) AS runs,
  sum(earned_runs) AS earned_runs,
  sum(hits) AS hits,
  sum(walks) AS walks,
  sum(strikeouts) AS strikeouts`;
