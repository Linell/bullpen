-- Unfinished games poll into a small table so live upserts don't rewrite every stored feed.
CREATE TABLE IF NOT EXISTS live_game_feeds (
  game_pk    INTEGER PRIMARY KEY,
  season     INTEGER NOT NULL,
  feed_ts    VARCHAR NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  json       JSON NOT NULL
);

-- The newer copy of each game wins, so a stray live row can't shadow a later final.
CREATE OR REPLACE VIEW game_feeds AS
SELECT * FROM live_game_feeds l
WHERE NOT EXISTS (SELECT 1 FROM raw_game_feeds r WHERE r.game_pk = l.game_pk AND r.feed_ts > l.feed_ts)
UNION ALL
SELECT * FROM raw_game_feeds r
WHERE NOT EXISTS (SELECT 1 FROM live_game_feeds l WHERE l.game_pk = r.game_pk AND l.feed_ts >= r.feed_ts);
