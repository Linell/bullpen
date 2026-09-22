-- Tables derived from raw_game_feeds by sql/derive.sql. Never written by TypeScript.

-- One row per completed play in liveData.plays.allPlays. Most are plate appearances, but a
-- play can also end an inning without one (e.g. caught stealing for the third out).
CREATE TABLE IF NOT EXISTS plate_appearances (
  game_pk                  INTEGER NOT NULL,
  season                   INTEGER NOT NULL,
  at_bat_index             INTEGER NOT NULL,
  inning                   INTEGER NOT NULL,
  half                     VARCHAR NOT NULL,   -- top | bottom
  batter_id                INTEGER NOT NULL,
  pitcher_id               INTEGER NOT NULL,
  bat_side                 VARCHAR,            -- L | R
  pitch_hand               VARCHAR,            -- L | R
  men_on_base              VARCHAR,            -- Empty | Men_On | RISP | Loaded
  event                    VARCHAR,            -- "Strikeout"
  event_type               VARCHAR,            -- "strikeout"
  description              VARCHAR,
  rbi                      INTEGER,
  is_out                   BOOLEAN,
  is_scoring_play          BOOLEAN,
  balls                    INTEGER,            -- final count
  strikes                  INTEGER,
  outs_after               INTEGER,
  home_score               INTEGER,            -- score after the play
  away_score               INTEGER,
  pitch_count              INTEGER NOT NULL,
  -- Final ball in play, if any.
  launch_speed             DOUBLE,
  launch_angle             DOUBLE,
  total_distance           DOUBLE,
  trajectory               VARCHAR,
  hardness                 VARCHAR,
  hit_location             VARCHAR,
  hit_coord_x              DOUBLE,
  hit_coord_y              DOUBLE,
  -- Play-level review. reviewType MJ is an ABS challenge, others are replay reviews.
  has_review               BOOLEAN,
  review_type              VARCHAR,
  review_overturned        BOOLEAN,
  review_challenge_team_id INTEGER,
  review_player_id         INTEGER,
  start_time               TIMESTAMPTZ,
  end_time                 TIMESTAMPTZ,
  PRIMARY KEY (game_pk, at_bat_index)
);

-- One row per playEvents[] entry with isPitch. pitch_index is playEvents[].index.
CREATE TABLE IF NOT EXISTS pitches (
  game_pk                INTEGER NOT NULL,
  season                 INTEGER NOT NULL,
  at_bat_index           INTEGER NOT NULL,
  pitch_index            INTEGER NOT NULL,
  play_id                VARCHAR,
  pitch_number           INTEGER,
  inning                 INTEGER NOT NULL,
  half                   VARCHAR NOT NULL,
  batter_id              INTEGER NOT NULL,
  pitcher_id             INTEGER NOT NULL,
  bat_side               VARCHAR,
  pitch_hand             VARCHAR,
  balls_before           INTEGER NOT NULL,
  strikes_before         INTEGER NOT NULL,
  outs_before            INTEGER NOT NULL,
  pitch_type             VARCHAR,            -- FF
  pitch_type_desc        VARCHAR,            -- Four-Seam Fastball
  type_confidence        DOUBLE,
  call_code              VARCHAR,            -- C
  call_desc              VARCHAR,            -- Called Strike
  description            VARCHAR,
  is_in_play             BOOLEAN,
  is_strike              BOOLEAN,
  is_ball                BOOLEAN,
  is_out                 BOOLEAN,
  start_speed            DOUBLE,
  end_speed              DOUBLE,
  spin_rate              DOUBLE,
  spin_direction         DOUBLE,
  extension              DOUBLE,
  plate_time             DOUBLE,
  px                     DOUBLE,             -- feet from the plate's center, catcher's view
  pz                     DOUBLE,             -- feet above the ground
  pfx_x                  DOUBLE,             -- inches
  pfx_z                  DOUBLE,
  x0                     DOUBLE,
  y0                     DOUBLE,
  z0                     DOUBLE,
  vx0                    DOUBLE,
  vy0                    DOUBLE,
  vz0                    DOUBLE,
  ax                     DOUBLE,
  ay                     DOUBLE,
  az                     DOUBLE,
  break_angle            DOUBLE,
  break_length           DOUBLE,
  break_y                DOUBLE,
  break_vertical         DOUBLE,
  induced_vertical_break DOUBLE,             -- inches
  horizontal_break       DOUBLE,
  zone                   INTEGER,
  sz_top                 DOUBLE,
  sz_bottom              DOUBLE,
  launch_speed           DOUBLE,
  launch_angle           DOUBLE,
  total_distance         DOUBLE,
  trajectory             VARCHAR,
  hardness               VARCHAR,
  hit_location           VARCHAR,
  -- ABS challenge of this pitch's ball/strike call. The call above is the final one.
  abs_challenged         BOOLEAN NOT NULL,
  abs_overturned         BOOLEAN,
  abs_challenge_team_id  INTEGER,
  abs_challenger_id      INTEGER,
  start_time             TIMESTAMPTZ,
  end_time               TIMESTAMPTZ,
  PRIMARY KEY (game_pk, at_bat_index, pitch_index)
);

-- Latest row per player from gameData.players. source_* identify the game it came from.
CREATE TABLE IF NOT EXISTS players (
  player_id          INTEGER PRIMARY KEY,
  season             INTEGER NOT NULL,
  full_name          VARCHAR NOT NULL,
  first_name         VARCHAR,
  last_name          VARCHAR,
  boxscore_name      VARCHAR,
  primary_number     VARCHAR,
  primary_position   VARCHAR,            -- abbreviation: P, C, 1B, ...
  bat_side           VARCHAR,
  pitch_hand         VARCHAR,
  birth_date         DATE,
  height             VARCHAR,
  weight             INTEGER,
  mlb_debut_date     DATE,
  active             BOOLEAN,
  sz_top             DOUBLE,
  sz_bottom          DOUBLE,
  source_game_pk     INTEGER NOT NULL,
  source_date        DATE NOT NULL,
  source_game_number INTEGER NOT NULL
);

-- Latest row per team from gameData.teams.
CREATE TABLE IF NOT EXISTS teams (
  team_id            INTEGER PRIMARY KEY,
  season             INTEGER NOT NULL,
  name               VARCHAR NOT NULL,   -- Baltimore Orioles
  team_name          VARCHAR,            -- Orioles
  abbreviation       VARCHAR,            -- BAL
  location_name      VARCHAR,            -- Baltimore
  short_name         VARCHAR,
  team_code          VARCHAR,
  league_id          INTEGER,
  league_name        VARCHAR,
  division_id        INTEGER,
  division_name      VARCHAR,
  venue_id           INTEGER,
  venue_name         VARCHAR,
  source_game_pk     INTEGER NOT NULL,
  source_date        DATE NOT NULL,
  source_game_number INTEGER NOT NULL
);
