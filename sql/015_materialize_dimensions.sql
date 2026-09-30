CREATE TABLE player_dimension (
  player_id          INTEGER PRIMARY KEY,
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
  source_game_pk     INTEGER NOT NULL,
  source_date        DATE NOT NULL,
  source_game_number INTEGER NOT NULL
);

CREATE TABLE team_dimension (
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
  source_game_pk     INTEGER NOT NULL,
  source_date        DATE NOT NULL,
  source_game_number INTEGER NOT NULL,
  PRIMARY KEY (team_id, season)
);

CREATE TABLE starter_dimension (
  game_pk    INTEGER NOT NULL,
  side       team_side NOT NULL,
  pitcher_id INTEGER,
  PRIMARY KEY (game_pk, side)
);

INSERT INTO player_dimension BY NAME SELECT * FROM players;
INSERT INTO team_dimension BY NAME SELECT * FROM teams;
INSERT INTO starter_dimension BY NAME SELECT * FROM game_starters;

DROP VIEW players;
DROP VIEW teams;
DROP VIEW game_starters;

ALTER TABLE player_dimension RENAME TO players;
ALTER TABLE team_dimension RENAME TO teams;
ALTER TABLE starter_dimension RENAME TO game_starters;
