CREATE TABLE teams_by_season (
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
INSERT INTO teams_by_season SELECT * FROM teams;
DROP TABLE teams;
ALTER TABLE teams_by_season RENAME TO teams;
