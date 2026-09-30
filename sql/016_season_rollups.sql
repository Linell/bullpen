CREATE TABLE event_leaders (
  season            INTEGER NOT NULL,
  official_date     DATE NOT NULL,
  board             VARCHAR NOT NULL,
  player_id         INTEGER,
  opponent_id       INTEGER,
  value             DOUBLE NOT NULL,
  pitch_type        VARCHAR,
  count             VARCHAR,
  result            VARCHAR,
  game_pk           INTEGER NOT NULL,
  at_bat_index      INTEGER NOT NULL,
  pitch_index       INTEGER NOT NULL
);

CREATE TABLE batted_ball_days (
  season            INTEGER NOT NULL,
  official_date     DATE NOT NULL,
  player_id         INTEGER,
  batted_balls      BIGINT NOT NULL,
  hard_hits         BIGINT NOT NULL,
  barrels           BIGINT NOT NULL,
  launch_speed_sum  DOUBLE
);

CREATE TABLE pitch_outcome_days (
  season              INTEGER NOT NULL,
  official_date       DATE NOT NULL,
  player_id           INTEGER,
  pitches             BIGINT NOT NULL,
  swings              BIGINT NOT NULL,
  whiffs              BIGINT NOT NULL,
  called_strikes      BIGINT NOT NULL,
  out_of_zone_pitches BIGINT NOT NULL,
  chases              BIGINT NOT NULL,
  zone_swings         BIGINT NOT NULL,
  zone_contacts       BIGINT NOT NULL
);

CREATE TABLE player_season_counts (
  season              INTEGER NOT NULL,
  role                VARCHAR NOT NULL,
  player_id           INTEGER,
  plate_appearances   BIGINT NOT NULL,
  at_bats             BIGINT NOT NULL,
  hits                BIGINT NOT NULL,
  total_bases         BIGINT,
  home_runs           BIGINT NOT NULL,
  walks               BIGINT NOT NULL,
  hit_by_pitch        BIGINT NOT NULL,
  sac_flies           BIGINT NOT NULL,
  strikeouts          BIGINT NOT NULL,
  batted_balls        BIGINT NOT NULL,
  hard_hits           BIGINT NOT NULL,
  barrels             BIGINT NOT NULL,
  exit_velocity       DOUBLE,
  pitches             BIGINT,
  swings              BIGINT,
  whiffs              BIGINT,
  called_strikes      BIGINT,
  fastball_velocity   DOUBLE,
  out_of_zone_pitches BIGINT,
  chases              BIGINT,
  zone_swings         BIGINT,
  zone_contacts       BIGINT
);

CREATE TABLE team_season_batting (
  season            INTEGER NOT NULL,
  team_id           INTEGER,
  scope             VARCHAR NOT NULL,
  split             VARCHAR NOT NULL,
  teams             BIGINT NOT NULL,
  games             BIGINT NOT NULL,
  plate_appearances BIGINT NOT NULL,
  at_bats           BIGINT NOT NULL,
  hits              BIGINT NOT NULL,
  total_bases       BIGINT,
  home_runs         BIGINT NOT NULL,
  walks             BIGINT NOT NULL,
  hit_by_pitch      BIGINT NOT NULL,
  sac_flies         BIGINT NOT NULL,
  strikeouts        BIGINT NOT NULL,
  batted_balls      BIGINT NOT NULL,
  hard_hits         BIGINT NOT NULL,
  barrels           BIGINT NOT NULL,
  exit_velocity     DOUBLE
);

CREATE TABLE team_season_swing_decisions (
  season              INTEGER NOT NULL,
  team_id             INTEGER,
  scope               VARCHAR NOT NULL,
  out_of_zone_pitches BIGINT NOT NULL,
  chases              BIGINT NOT NULL,
  zone_swings         BIGINT NOT NULL,
  zone_contacts       BIGINT NOT NULL
);

CREATE TABLE team_season_pitching (
  season        INTEGER NOT NULL,
  team_id       INTEGER,
  scope         VARCHAR NOT NULL,
  teams         BIGINT NOT NULL,
  batters_faced BIGINT,
  outs          BIGINT,
  runs          BIGINT,
  earned_runs   BIGINT,
  hits          BIGINT,
  walks         BIGINT,
  strikeouts    BIGINT
);

CREATE TABLE team_season_pitches (
  season            INTEGER NOT NULL,
  team_id           INTEGER,
  scope             VARCHAR NOT NULL,
  pitches           BIGINT NOT NULL,
  swings            BIGINT NOT NULL,
  whiffs            BIGINT NOT NULL,
  called_strikes    BIGINT NOT NULL,
  fastball_velocity DOUBLE
);
