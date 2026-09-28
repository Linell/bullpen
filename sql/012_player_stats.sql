CREATE TABLE event_types (
  event_type          VARCHAR PRIMARY KEY,
  is_plate_appearance       BOOLEAN NOT NULL,
  is_at_bat                 BOOLEAN NOT NULL,
  is_ball_in_play           BOOLEAN NOT NULL,
  is_walk                   BOOLEAN NOT NULL,
  is_strikeout              BOOLEAN NOT NULL,
  bases               INTEGER NOT NULL
);

INSERT INTO event_types
SELECT
  event_type,
  true AS is_plate_appearance,
  event_type NOT IN (
    'walk', 'intent_walk', 'hit_by_pitch', 'catcher_interf',
    'sac_fly', 'sac_fly_double_play', 'sac_bunt', 'sac_bunt_double_play'
  ) AS is_at_bat,
  event_type NOT IN (
    'walk', 'intent_walk', 'hit_by_pitch', 'catcher_interf',
    'strikeout', 'strike_out', 'strikeout_double_play', 'strikeout_triple_play'
  ) AS is_ball_in_play,
  event_type IN ('walk', 'intent_walk') AS is_walk,
  event_type IN ('strikeout', 'strike_out', 'strikeout_double_play', 'strikeout_triple_play') AS is_strikeout,
  CASE event_type WHEN 'single' THEN 1 WHEN 'double' THEN 2 WHEN 'triple' THEN 3 WHEN 'home_run' THEN 4 ELSE 0 END AS bases
FROM unnest([
  'single', 'double', 'triple', 'home_run',
  'field_out', 'force_out', 'fielders_choice', 'fielders_choice_out', 'field_error',
  'double_play', 'triple_play', 'grounded_into_double_play', 'grounded_into_triple_play',
  'strikeout', 'strike_out', 'strikeout_double_play', 'strikeout_triple_play',
  'walk', 'intent_walk', 'hit_by_pitch', 'catcher_interf',
  'sac_fly', 'sac_fly_double_play', 'sac_bunt', 'sac_bunt_double_play',
  'batter_interference', 'fan_interference', 'os_ruling_pending_primary'
]) AS plate_appearance_events(event_type);

INSERT INTO event_types
SELECT event_type, false, false, false, false, false, 0
FROM unnest([
  'stolen_base', 'stolen_base_2b', 'stolen_base_3b', 'stolen_base_home',
  'caught_stealing', 'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_1b', 'pickoff_2b', 'pickoff_3b', 'pickoff_error_1b', 'pickoff_error_2b', 'pickoff_error_3b',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
  'wild_pitch', 'passed_ball', 'balk', 'forced_balk', 'defensive_indiff', 'error',
  'other_out', 'other_advance', 'runner_double_play', 'cs_double_play',
  'fielder_interference', 'runner_interference', 'os_ruling_pending_prior',
  'pitcher_step_off', 'batter_timeout', 'mound_visit', 'no_pitch', 'batter_turn', 'at_bat_start',
  'runner_placed', 'pitching_substitution', 'offensive_substitution', 'defensive_substitution',
  'defensive_switch', 'umpire_substitution', 'pitcher_switch', 'injury', 'ejection', 'game_advisory'
]) AS other_events(event_type);

CREATE TABLE player_game_batting (
  game_pk                   INTEGER NOT NULL,
  season                    INTEGER NOT NULL,
  player_id                 INTEGER NOT NULL,
  team_id                   INTEGER NOT NULL,
  plate_appearances         INTEGER NOT NULL,
  at_bats                   INTEGER NOT NULL,
  runs                      INTEGER NOT NULL,
  hits                      INTEGER NOT NULL,
  doubles                   INTEGER NOT NULL,
  triples                   INTEGER NOT NULL,
  home_runs                 INTEGER NOT NULL,
  total_bases               INTEGER NOT NULL,
  rbi                       INTEGER NOT NULL,
  walks                     INTEGER NOT NULL,
  intentional_walks         INTEGER NOT NULL,
  strikeouts                INTEGER NOT NULL,
  hit_by_pitch              INTEGER NOT NULL,
  sac_flies                 INTEGER NOT NULL,
  sac_bunts                 INTEGER NOT NULL,
  stolen_bases              INTEGER NOT NULL,
  caught_stealing           INTEGER NOT NULL,
  grounded_into_double_play INTEGER NOT NULL,
  left_on_base              INTEGER NOT NULL,
  PRIMARY KEY (game_pk, player_id, team_id)
);

CREATE TABLE player_game_pitching (
  game_pk                   INTEGER NOT NULL,
  season                    INTEGER NOT NULL,
  player_id                 INTEGER NOT NULL,
  team_id                   INTEGER NOT NULL,
  is_starter                BOOLEAN NOT NULL,
  outs                      INTEGER NOT NULL,
  batters_faced             INTEGER NOT NULL,
  pitches                   INTEGER NOT NULL,
  strikes                   INTEGER NOT NULL,
  hits                      INTEGER NOT NULL,
  runs                      INTEGER NOT NULL,
  earned_runs               INTEGER NOT NULL,
  home_runs                 INTEGER NOT NULL,
  walks                     INTEGER NOT NULL,
  intentional_walks         INTEGER NOT NULL,
  strikeouts                INTEGER NOT NULL,
  hit_batsmen               INTEGER NOT NULL,
  wild_pitches              INTEGER NOT NULL,
  balks                     INTEGER NOT NULL,
  inherited_runners         INTEGER NOT NULL,
  inherited_runners_scored  INTEGER NOT NULL,
  is_win                    BOOLEAN NOT NULL,
  is_loss                   BOOLEAN NOT NULL,
  is_save                   BOOLEAN NOT NULL,
  is_hold                   BOOLEAN NOT NULL,
  is_blown_save             BOOLEAN NOT NULL,
  PRIMARY KEY (game_pk, player_id, team_id)
);

CREATE VIEW plate_appearances AS
SELECT
  p.* REPLACE (
    CASE WHEN e.is_ball_in_play THEN p.launch_speed END AS launch_speed,
    CASE WHEN e.is_ball_in_play THEN p.launch_angle END AS launch_angle,
    CASE WHEN e.is_ball_in_play THEN p.hit_coord_x END AS hit_coord_x,
    CASE WHEN e.is_ball_in_play THEN p.hit_coord_y END AS hit_coord_y
  ),
  e.is_at_bat,
  e.is_ball_in_play,
  e.is_walk,
  e.is_strikeout,
  e.bases
FROM team_plays p
JOIN event_types e USING (event_type)
WHERE e.is_plate_appearance;

CREATE VIEW pitch_outcomes AS
SELECT
  *,
  call_code IN ('S', 'W', 'M', 'T', 'F', 'L', 'X', 'D', 'E') AS is_swing,
  call_code IN ('S', 'W', 'M') AS is_whiff,
  call_code = 'C' AS is_called_strike,
  zone BETWEEN 1 AND 9 AS is_in_zone,
  pitch_type IN ('FF', 'SI') AS is_fastball
FROM team_pitches;
