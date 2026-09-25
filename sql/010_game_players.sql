CREATE TABLE IF NOT EXISTS game_players (
  game_pk        INTEGER NOT NULL,
  season         INTEGER NOT NULL,
  player_id      INTEGER NOT NULL,
  team_id        INTEGER NOT NULL,
  side           team_side NOT NULL,
  jersey_number  VARCHAR,
  position       VARCHAR,
  all_positions  VARCHAR[],
  batting_order  INTEGER,
  is_substitute  BOOLEAN,
  played         BOOLEAN NOT NULL,
  PRIMARY KEY (game_pk, player_id, side)
);
