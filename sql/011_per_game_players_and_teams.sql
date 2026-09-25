CREATE TABLE game_player_bios (
  game_pk            INTEGER NOT NULL,
  player_id          INTEGER NOT NULL,
  full_name          VARCHAR NOT NULL,
  first_name         VARCHAR,
  last_name          VARCHAR,
  boxscore_name      VARCHAR,
  bat_side           handedness,
  pitch_hand         handedness,
  birth_date         DATE,
  height             VARCHAR,
  weight             INTEGER,
  mlb_debut_date     DATE,
  active             BOOLEAN,
  sz_top             DOUBLE,
  sz_bottom          DOUBLE,
  source_date        DATE NOT NULL,
  source_game_number INTEGER NOT NULL,
  PRIMARY KEY (game_pk, player_id)
);

CREATE TABLE game_teams (
  game_pk            INTEGER NOT NULL,
  team_id            INTEGER NOT NULL,
  season             INTEGER NOT NULL,
  name               VARCHAR NOT NULL,
  team_name          VARCHAR,
  abbreviation       VARCHAR,
  location_name      VARCHAR,
  short_name         VARCHAR,
  team_code          VARCHAR,
  league_id          INTEGER,
  league_name        VARCHAR,
  division_id        INTEGER,
  division_name      VARCHAR,
  venue_id           INTEGER,
  venue_name         VARCHAR,
  source_date        DATE NOT NULL,
  source_game_number INTEGER NOT NULL,
  PRIMARY KEY (game_pk, team_id)
);

INSERT INTO game_player_bios BY NAME
SELECT * EXCLUDE (source_game_pk), source_game_pk AS game_pk FROM players;

INSERT INTO game_teams BY NAME
SELECT * EXCLUDE (source_game_pk), source_game_pk AS game_pk FROM teams;

DROP TABLE players;
DROP TABLE teams;

CREATE VIEW players AS
SELECT
  player_id, full_name, first_name, last_name, boxscore_name, bat_side, pitch_hand, birth_date, height,
  weight, mlb_debut_date, active, sz_top, sz_bottom,
  game_pk AS source_game_pk, source_date, source_game_number
FROM game_player_bios
QUALIFY row_number() OVER (
  PARTITION BY player_id ORDER BY source_date DESC, source_game_number DESC, game_pk DESC
) = 1;

CREATE VIEW teams AS
SELECT
  team_id, season, name, team_name, abbreviation, location_name, short_name, team_code,
  league_id, league_name, division_id, division_name, venue_id, venue_name,
  game_pk AS source_game_pk, source_date, source_game_number
FROM game_teams
QUALIFY row_number() OVER (
  PARTITION BY team_id, season ORDER BY source_date DESC, source_game_number DESC, game_pk DESC
) = 1;
