CREATE TYPE IF NOT EXISTS team_side AS ENUM ('home', 'away');

ALTER TABLE games ADD COLUMN IF NOT EXISTS home_probable_id INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_probable_name VARCHAR;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_probable_id INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_probable_name VARCHAR;

CREATE TABLE IF NOT EXISTS probable_pitchers (
  game_pk      INTEGER NOT NULL,
  side         team_side NOT NULL,
  pitcher_id   INTEGER,
  pitcher_name VARCHAR,
  observed_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (game_pk, side, observed_at)
);

CREATE OR REPLACE VIEW game_starters AS
SELECT
  game_pk,
  CASE half WHEN 'top' THEN 'home' ELSE 'away' END::team_side AS side,
  arg_min(pitcher_id, at_bat_index) AS pitcher_id
FROM plays
GROUP BY ALL;
