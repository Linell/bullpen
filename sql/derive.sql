-- Rebuilds derived rows from raw_game_feeds for one game ($game_pk), or for every game
-- when $game_pk is NULL. Idempotent. lib/feeds.ts runs the statements one at a time.

DELETE FROM pitches
WHERE $game_pk::INTEGER IS NULL OR game_pk = $game_pk::INTEGER;

DELETE FROM plays
WHERE $game_pk::INTEGER IS NULL OR game_pk = $game_pk::INTEGER;

INSERT INTO plays BY NAME
WITH plays AS (
  SELECT game_pk, season, play, (play ->> '$.about.atBatIndex')::INTEGER AS at_bat_index
  FROM (
    SELECT f.game_pk, f.season, unnest(json_extract(f.json, '$.liveData.plays.allPlays[*]')) AS play
    FROM raw_game_feeds f
    WHERE $game_pk::INTEGER IS NULL OR f.game_pk = $game_pk::INTEGER
  )
  WHERE (play ->> '$.about.isComplete')::BOOLEAN
),
events AS (
  SELECT game_pk, at_bat_index, ev,
    (ev ->> '$.index')::INTEGER AS idx,
    coalesce((ev ->> '$.isPitch')::BOOLEAN, false) AS is_pitch
  FROM (SELECT game_pk, at_bat_index, unnest(json_extract(play, '$.playEvents[*]')) AS ev FROM plays)
),
agg AS (
  SELECT game_pk, at_bat_index,
    count(*) FILTER (WHERE is_pitch) AS pitch_count,
    arg_max(json_extract(ev, '$.hitData'), idx) FILTER (WHERE is_pitch AND json_extract(ev, '$.hitData') IS NOT NULL) AS hit
  FROM events
  GROUP BY ALL
)
SELECT
  p.game_pk,
  p.season,
  p.at_bat_index,
  (play ->> '$.about.inning')::INTEGER AS inning,
  play ->> '$.about.halfInning' AS half,
  (play ->> '$.matchup.batter.id')::INTEGER AS batter_id,
  (play ->> '$.matchup.pitcher.id')::INTEGER AS pitcher_id,
  play ->> '$.matchup.batSide.code' AS bat_side,
  play ->> '$.matchup.pitchHand.code' AS pitch_hand,
  play ->> '$.matchup.splits.menOnBase' AS men_on_base,
  play ->> '$.result.event' AS event,
  play ->> '$.result.eventType' AS event_type,
  play ->> '$.result.description' AS description,
  (play ->> '$.result.rbi')::INTEGER AS rbi,
  (play ->> '$.result.isOut')::BOOLEAN AS is_out,
  (play ->> '$.about.isScoringPlay')::BOOLEAN AS is_scoring_play,
  (play ->> '$.count.balls')::INTEGER AS final_balls,
  (play ->> '$.count.strikes')::INTEGER AS final_strikes,
  (play ->> '$.count.outs')::INTEGER AS outs_after,
  (play ->> '$.result.homeScore')::INTEGER AS home_score_after,
  (play ->> '$.result.awayScore')::INTEGER AS away_score_after,
  coalesce(a.pitch_count, 0) AS pitch_count,
  (hit ->> '$.launchSpeed')::DOUBLE AS launch_speed,
  (hit ->> '$.launchAngle')::DOUBLE AS launch_angle,
  (hit ->> '$.totalDistance')::DOUBLE AS total_distance,
  hit ->> '$.trajectory' AS trajectory,
  hit ->> '$.hardness' AS hardness,
  hit ->> '$.location' AS hit_location,
  (hit ->> '$.coordinates.coordX')::DOUBLE AS hit_coord_x,
  (hit ->> '$.coordinates.coordY')::DOUBLE AS hit_coord_y,
  coalesce((play ->> '$.about.hasReview')::BOOLEAN, false) AS has_review,
  play ->> '$.reviewDetails.reviewType' AS review_type,
  (play ->> '$.reviewDetails.isOverturned')::BOOLEAN AS review_overturned,
  (play ->> '$.reviewDetails.challengeTeamId')::INTEGER AS review_challenge_team_id,
  (play ->> '$.reviewDetails.player.id')::INTEGER AS review_player_id,
  (play ->> '$.about.startTime')::TIMESTAMPTZ AS start_time,
  (play ->> '$.about.endTime')::TIMESTAMPTZ AS end_time
FROM plays p
LEFT JOIN agg a USING (game_pk, at_bat_index);

INSERT INTO pitches BY NAME
WITH plays AS (
  SELECT game_pk, season, play, (play ->> '$.about.atBatIndex')::INTEGER AS at_bat_index
  FROM (
    SELECT f.game_pk, f.season, unnest(json_extract(f.json, '$.liveData.plays.allPlays[*]')) AS play
    FROM raw_game_feeds f
    WHERE $game_pk::INTEGER IS NULL OR f.game_pk = $game_pk::INTEGER
  )
  WHERE (play ->> '$.about.isComplete')::BOOLEAN
),
plays_ctx AS (
  -- Outs when the play started: the previous play's outs in the same half-inning.
  SELECT *,
    coalesce(lag((play ->> '$.count.outs')::INTEGER) OVER (
      PARTITION BY game_pk, play ->> '$.about.inning', play ->> '$.about.halfInning'
      ORDER BY at_bat_index
    ), 0) AS outs_start
  FROM plays
),
events AS (
  SELECT *,
    (ev ->> '$.index')::INTEGER AS idx,
    coalesce((ev ->> '$.isPitch')::BOOLEAN, false) AS is_pitch
  FROM (SELECT *, unnest(json_extract(play, '$.playEvents[*]')) AS ev FROM plays_ctx)
),
counted AS (
  -- Each event's count is after the event, so the count before is the previous event's.
  -- Lagging over every event, not just pitches, catches pitch clock violations and pickoffs.
  SELECT *,
    coalesce(lag((ev ->> '$.count.balls')::INTEGER) OVER w, 0) AS balls_before,
    coalesce(lag((ev ->> '$.count.strikes')::INTEGER) OVER w, 0) AS strikes_before,
    coalesce(lag((ev ->> '$.count.outs')::INTEGER) OVER w, outs_start) AS outs_before,
    idx = max(idx) FILTER (WHERE is_pitch) OVER (PARTITION BY game_pk, at_bat_index) AS is_last_pitch
  FROM events
  WINDOW w AS (PARTITION BY game_pk, at_bat_index ORDER BY idx)
),
pitch_rows AS (
  SELECT *,
    -- ABS challenges sit on the pitch, except a challenge of the play's final pitch,
    -- which the feed records on the play instead.
    CASE
      WHEN (ev ->> '$.reviewDetails.reviewType') = 'MJ' THEN json_extract(ev, '$.reviewDetails')
      WHEN is_last_pitch AND (play ->> '$.reviewDetails.reviewType') = 'MJ' THEN json_extract(play, '$.reviewDetails')
    END AS abs_review
  FROM counted
  WHERE is_pitch
)
SELECT
  game_pk,
  season,
  at_bat_index,
  idx AS pitch_index,
  ev ->> '$.playId' AS play_id,
  (ev ->> '$.pitchNumber')::INTEGER AS pitch_number,
  (play ->> '$.about.inning')::INTEGER AS inning,
  play ->> '$.about.halfInning' AS half,
  (play ->> '$.matchup.batter.id')::INTEGER AS batter_id,
  (play ->> '$.matchup.pitcher.id')::INTEGER AS pitcher_id,
  play ->> '$.matchup.batSide.code' AS bat_side,
  play ->> '$.matchup.pitchHand.code' AS pitch_hand,
  balls_before,
  strikes_before,
  outs_before,
  ev ->> '$.details.type.code' AS pitch_type,
  ev ->> '$.details.type.description' AS pitch_type_desc,
  (ev ->> '$.pitchData.typeConfidence')::DOUBLE AS type_confidence,
  ev ->> '$.details.call.code' AS call_code,
  ev ->> '$.details.call.description' AS call_desc,
  ev ->> '$.details.description' AS description,
  (ev ->> '$.details.isInPlay')::BOOLEAN AS is_in_play,
  (ev ->> '$.details.isStrike')::BOOLEAN AS is_strike,
  (ev ->> '$.details.isBall')::BOOLEAN AS is_ball,
  (ev ->> '$.details.isOut')::BOOLEAN AS is_out,
  (ev ->> '$.pitchData.startSpeed')::DOUBLE AS start_speed,
  (ev ->> '$.pitchData.endSpeed')::DOUBLE AS end_speed,
  (ev ->> '$.pitchData.breaks.spinRate')::DOUBLE AS spin_rate,
  (ev ->> '$.pitchData.breaks.spinDirection')::DOUBLE AS spin_direction,
  (ev ->> '$.pitchData.extension')::DOUBLE AS extension,
  (ev ->> '$.pitchData.plateTime')::DOUBLE AS plate_time,
  (ev ->> '$.pitchData.coordinates.pX')::DOUBLE AS plate_x,
  (ev ->> '$.pitchData.coordinates.pZ')::DOUBLE AS plate_z,
  (ev ->> '$.pitchData.coordinates.pfxX')::DOUBLE AS pfx_x,
  (ev ->> '$.pitchData.coordinates.pfxZ')::DOUBLE AS pfx_z,
  (ev ->> '$.pitchData.coordinates.x0')::DOUBLE AS x0,
  (ev ->> '$.pitchData.coordinates.y0')::DOUBLE AS y0,
  (ev ->> '$.pitchData.coordinates.z0')::DOUBLE AS z0,
  (ev ->> '$.pitchData.coordinates.vX0')::DOUBLE AS vx0,
  (ev ->> '$.pitchData.coordinates.vY0')::DOUBLE AS vy0,
  (ev ->> '$.pitchData.coordinates.vZ0')::DOUBLE AS vz0,
  (ev ->> '$.pitchData.coordinates.aX')::DOUBLE AS ax,
  (ev ->> '$.pitchData.coordinates.aY')::DOUBLE AS ay,
  (ev ->> '$.pitchData.coordinates.aZ')::DOUBLE AS az,
  (ev ->> '$.pitchData.breaks.breakAngle')::DOUBLE AS break_angle,
  (ev ->> '$.pitchData.breaks.breakLength')::DOUBLE AS break_length,
  (ev ->> '$.pitchData.breaks.breakY')::DOUBLE AS break_y,
  (ev ->> '$.pitchData.breaks.breakVertical')::DOUBLE AS break_vertical,
  (ev ->> '$.pitchData.breaks.breakVerticalInduced')::DOUBLE AS induced_vertical_break,
  (ev ->> '$.pitchData.breaks.breakHorizontal')::DOUBLE AS horizontal_break,
  (ev ->> '$.pitchData.zone')::INTEGER AS zone,
  (ev ->> '$.pitchData.strikeZoneTop')::DOUBLE AS sz_top,
  (ev ->> '$.pitchData.strikeZoneBottom')::DOUBLE AS sz_bottom,
  (ev ->> '$.hitData.launchSpeed')::DOUBLE AS launch_speed,
  (ev ->> '$.hitData.launchAngle')::DOUBLE AS launch_angle,
  (ev ->> '$.hitData.totalDistance')::DOUBLE AS total_distance,
  ev ->> '$.hitData.trajectory' AS trajectory,
  ev ->> '$.hitData.hardness' AS hardness,
  ev ->> '$.hitData.location' AS hit_location,
  abs_review IS NOT NULL AS abs_challenged,
  (abs_review ->> '$.isOverturned')::BOOLEAN AS abs_overturned,
  (abs_review ->> '$.challengeTeamId')::INTEGER AS abs_challenge_team_id,
  (abs_review ->> '$.player.id')::INTEGER AS abs_challenger_id,
  (ev ->> '$.startTime')::TIMESTAMPTZ AS start_time,
  (ev ->> '$.endTime')::TIMESTAMPTZ AS end_time
FROM pitch_rows;

-- Players and teams keep the row from the most recent game: newest official date, then
-- the later game of a doubleheader. Older games never overwrite newer ones.
INSERT OR REPLACE INTO teams BY NAME
WITH src AS (
  SELECT
    f.season,
    f.game_pk AS source_game_pk,
    (f.json ->> '$.gameData.datetime.officialDate')::DATE AS source_date,
    coalesce((f.json ->> '$.gameData.game.gameNumber')::INTEGER, 1) AS source_game_number,
    unnest([json_extract(f.json, '$.gameData.teams.home'), json_extract(f.json, '$.gameData.teams.away')]) AS t
  FROM raw_game_feeds f
  WHERE $game_pk::INTEGER IS NULL OR f.game_pk = $game_pk::INTEGER
),
latest AS (
  SELECT
    (t ->> '$.id')::INTEGER AS team_id,
    season,
    t ->> '$.name' AS name,
    t ->> '$.teamName' AS team_name,
    t ->> '$.abbreviation' AS abbreviation,
    t ->> '$.locationName' AS location_name,
    t ->> '$.shortName' AS short_name,
    t ->> '$.teamCode' AS team_code,
    (t ->> '$.league.id')::INTEGER AS league_id,
    t ->> '$.league.name' AS league_name,
    (t ->> '$.division.id')::INTEGER AS division_id,
    t ->> '$.division.name' AS division_name,
    (t ->> '$.venue.id')::INTEGER AS venue_id,
    t ->> '$.venue.name' AS venue_name,
    source_game_pk,
    source_date,
    source_game_number
  FROM src
  WHERE (t ->> '$.id') IS NOT NULL
  QUALIFY row_number() OVER (
    PARTITION BY team_id ORDER BY source_date DESC, source_game_number DESC, source_game_pk DESC
  ) = 1
)
SELECT l.* FROM latest l
LEFT JOIN teams cur USING (team_id)
WHERE cur.team_id IS NULL
  OR (l.source_date, l.source_game_number, l.source_game_pk)
     >= (cur.source_date, cur.source_game_number, cur.source_game_pk);

INSERT OR REPLACE INTO players BY NAME
WITH src AS (
  SELECT
    f.season,
    f.game_pk AS source_game_pk,
    (f.json ->> '$.gameData.datetime.officialDate')::DATE AS source_date,
    coalesce((f.json ->> '$.gameData.game.gameNumber')::INTEGER, 1) AS source_game_number,
    unnest(json_extract(f.json, '$.gameData.players.*')) AS p
  FROM raw_game_feeds f
  WHERE $game_pk::INTEGER IS NULL OR f.game_pk = $game_pk::INTEGER
),
latest AS (
  SELECT
    (p ->> '$.id')::INTEGER AS player_id,
    season,
    p ->> '$.fullName' AS full_name,
    p ->> '$.firstName' AS first_name,
    p ->> '$.lastName' AS last_name,
    p ->> '$.boxscoreName' AS boxscore_name,
    p ->> '$.primaryNumber' AS primary_number,
    p ->> '$.primaryPosition.abbreviation' AS primary_position,
    p ->> '$.batSide.code' AS bat_side,
    p ->> '$.pitchHand.code' AS pitch_hand,
    try_cast(p ->> '$.birthDate' AS DATE) AS birth_date,
    p ->> '$.height' AS height,
    (p ->> '$.weight')::INTEGER AS weight,
    try_cast(p ->> '$.mlbDebutDate' AS DATE) AS mlb_debut_date,
    (p ->> '$.active')::BOOLEAN AS active,
    (p ->> '$.strikeZoneTop')::DOUBLE AS sz_top,
    (p ->> '$.strikeZoneBottom')::DOUBLE AS sz_bottom,
    source_game_pk,
    source_date,
    source_game_number
  FROM src
  WHERE (p ->> '$.id') IS NOT NULL
  QUALIFY row_number() OVER (
    PARTITION BY player_id ORDER BY source_date DESC, source_game_number DESC, source_game_pk DESC
  ) = 1
)
SELECT l.* FROM latest l
LEFT JOIN players cur USING (player_id)
WHERE cur.player_id IS NULL
  OR (l.source_date, l.source_game_number, l.source_game_pk)
     >= (cur.source_date, cur.source_game_number, cur.source_game_pk);
