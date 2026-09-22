-- Tables written by TypeScript. Derived tables live in later files.

CREATE TABLE IF NOT EXISTS raw_game_feeds (
  game_pk    INTEGER PRIMARY KEY,
  season     INTEGER NOT NULL,
  feed_ts    VARCHAR NOT NULL,  -- metaData.timeStamp, e.g. 20260922_015215
  fetched_at TIMESTAMPTZ NOT NULL,
  json       JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  game_pk        INTEGER PRIMARY KEY,
  season         INTEGER NOT NULL,
  official_date  DATE NOT NULL,
  game_type      VARCHAR NOT NULL,
  game_number    INTEGER NOT NULL,
  abstract_state VARCHAR NOT NULL,
  coded_state    VARCHAR NOT NULL,
  detailed_state VARCHAR NOT NULL,
  home_team_id   INTEGER NOT NULL,
  away_team_id   INTEGER NOT NULL,
  home_score     INTEGER,
  away_score     INTEGER,
  inning         INTEGER,
  inning_half    VARCHAR,
  start_utc      TIMESTAMPTZ NOT NULL,
  venue_name     VARCHAR,
  home_record    VARCHAR,           -- "88-66", from the schedule's leagueRecord
  away_record    VARCHAR,
  updated_at     TIMESTAMPTZ NOT NULL
);
