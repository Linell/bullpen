CREATE TABLE IF NOT EXISTS linescores (
  game_pk      INTEGER NOT NULL,
  season       INTEGER NOT NULL,
  inning       INTEGER NOT NULL,
  half         inning_half NOT NULL,
  runs         INTEGER,
  hits         INTEGER,
  errors       INTEGER,
  left_on_base INTEGER,
  PRIMARY KEY (game_pk, inning, half)
);

CREATE TABLE IF NOT EXISTS game_decisions (
  game_pk   INTEGER PRIMARY KEY,
  season    INTEGER NOT NULL,
  winner_id INTEGER NOT NULL,
  loser_id  INTEGER,
  save_id   INTEGER
);

CREATE TABLE IF NOT EXISTS play_events (
  game_pk         INTEGER NOT NULL,
  season          INTEGER NOT NULL,
  at_bat_index    INTEGER NOT NULL,
  event_index     INTEGER NOT NULL,
  kind            VARCHAR,
  event_type      VARCHAR,
  call_code       VARCHAR,
  description     VARCHAR,
  is_scoring_play BOOLEAN,
  player_id       INTEGER,
  start_time      TIMESTAMPTZ,
  PRIMARY KEY (game_pk, at_bat_index, event_index)
);
