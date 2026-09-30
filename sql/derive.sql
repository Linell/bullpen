CREATE OR REPLACE TEMP TABLE feed AS
WITH parsed AS (
  -- Only the feed fields we read, typed once.
  SELECT game_pk, season, json_transform(json, '{
    "gameData": {
      "datetime": {"officialDate": "DATE"},
      "game": {"gameNumber": "INTEGER"},
      "teams": "MAP(VARCHAR, STRUCT(id INTEGER, name VARCHAR, teamName VARCHAR, abbreviation VARCHAR, locationName VARCHAR, shortName VARCHAR, teamCode VARCHAR, league STRUCT(id INTEGER, name VARCHAR), division STRUCT(id INTEGER, name VARCHAR), venue STRUCT(id INTEGER, name VARCHAR)))",
      "players": "MAP(VARCHAR, STRUCT(id INTEGER, fullName VARCHAR, firstName VARCHAR, lastName VARCHAR, boxscoreName VARCHAR, batSide STRUCT(code VARCHAR), pitchHand STRUCT(code VARCHAR), birthDate DATE, height VARCHAR, weight INTEGER, mlbDebutDate DATE, active BOOLEAN, strikeZoneTop DOUBLE, strikeZoneBottom DOUBLE))"
    },
    "liveData": {
      "boxscore": {"teams": "MAP(VARCHAR, STRUCT(team STRUCT(id INTEGER), players MAP(VARCHAR, STRUCT(person STRUCT(id INTEGER), jerseyNumber VARCHAR, position STRUCT(abbreviation VARCHAR), battingOrder INTEGER, gameStatus STRUCT(isSubstitute BOOLEAN), allPositions STRUCT(abbreviation VARCHAR)[], stats STRUCT(batting STRUCT(gamesPlayed INTEGER, plateAppearances INTEGER, atBats INTEGER, runs INTEGER, hits INTEGER, doubles INTEGER, triples INTEGER, homeRuns INTEGER, totalBases INTEGER, rbi INTEGER, baseOnBalls INTEGER, intentionalWalks INTEGER, strikeOuts INTEGER, hitByPitch INTEGER, sacFlies INTEGER, sacBunts INTEGER, stolenBases INTEGER, caughtStealing INTEGER, groundIntoDoublePlay INTEGER, leftOnBase INTEGER), pitching STRUCT(gamesPlayed INTEGER, gamesStarted INTEGER, outs INTEGER, battersFaced INTEGER, numberOfPitches INTEGER, strikes INTEGER, hits INTEGER, runs INTEGER, earnedRuns INTEGER, homeRuns INTEGER, baseOnBalls INTEGER, intentionalWalks INTEGER, strikeOuts INTEGER, hitBatsmen INTEGER, wildPitches INTEGER, balks INTEGER, inheritedRunners INTEGER, inheritedRunnersScored INTEGER, wins INTEGER, losses INTEGER, saves INTEGER, holds INTEGER, blownSaves INTEGER))))))"},
      "linescore": {"innings": [{
        "num": "INTEGER",
        "home": {"runs": "INTEGER", "hits": "INTEGER", "errors": "INTEGER", "leftOnBase": "INTEGER"},
        "away": {"runs": "INTEGER", "hits": "INTEGER", "errors": "INTEGER", "leftOnBase": "INTEGER"}
      }]},
      "decisions": {"winner": {"id": "INTEGER"}, "loser": {"id": "INTEGER"}, "save": {"id": "INTEGER"}},
      "plays": {"allPlays": [{
        "about": {
          "atBatIndex": "INTEGER", "inning": "INTEGER", "halfInning": "VARCHAR", "isComplete": "BOOLEAN",
          "isScoringPlay": "BOOLEAN", "hasReview": "BOOLEAN", "startTime": "TIMESTAMPTZ", "endTime": "TIMESTAMPTZ"
        },
        "matchup": {
          "batter": {"id": "INTEGER"}, "pitcher": {"id": "INTEGER"},
          "batSide": {"code": "VARCHAR"}, "pitchHand": {"code": "VARCHAR"}, "splits": {"menOnBase": "VARCHAR"}
        },
        "result": {
          "event": "VARCHAR", "eventType": "VARCHAR", "description": "VARCHAR", "rbi": "INTEGER",
          "isOut": "BOOLEAN", "homeScore": "INTEGER", "awayScore": "INTEGER"
        },
        "count": {"balls": "INTEGER", "strikes": "INTEGER", "outs": "INTEGER"},
        "reviewDetails": {"reviewType": "VARCHAR", "isOverturned": "BOOLEAN", "challengeTeamId": "INTEGER", "player": {"id": "INTEGER"}},
        "playEvents": [{
          "index": "INTEGER", "isPitch": "BOOLEAN", "type": "VARCHAR", "playId": "VARCHAR", "pitchNumber": "INTEGER",
          "startTime": "TIMESTAMPTZ", "endTime": "TIMESTAMPTZ", "player": {"id": "INTEGER"},
          "count": {"balls": "INTEGER", "strikes": "INTEGER", "outs": "INTEGER"},
          "details": {
            "call": {"code": "VARCHAR", "description": "VARCHAR"}, "type": {"code": "VARCHAR", "description": "VARCHAR"},
            "description": "VARCHAR", "eventType": "VARCHAR", "isScoringPlay": "BOOLEAN",
            "isInPlay": "BOOLEAN", "isStrike": "BOOLEAN", "isBall": "BOOLEAN", "isOut": "BOOLEAN"
          },
          "pitchData": {
            "startSpeed": "DOUBLE", "endSpeed": "DOUBLE", "extension": "DOUBLE", "plateTime": "DOUBLE",
            "typeConfidence": "DOUBLE", "zone": "INTEGER", "strikeZoneTop": "DOUBLE", "strikeZoneBottom": "DOUBLE",
            "coordinates": {
              "pX": "DOUBLE", "pZ": "DOUBLE", "pfxX": "DOUBLE", "pfxZ": "DOUBLE",
              "x0": "DOUBLE", "y0": "DOUBLE", "z0": "DOUBLE", "vX0": "DOUBLE", "vY0": "DOUBLE", "vZ0": "DOUBLE",
              "aX": "DOUBLE", "aY": "DOUBLE", "aZ": "DOUBLE"
            },
            "breaks": {
              "breakAngle": "DOUBLE", "breakLength": "DOUBLE", "breakY": "DOUBLE", "breakVertical": "DOUBLE",
              "breakVerticalInduced": "DOUBLE", "breakHorizontal": "DOUBLE", "spinRate": "DOUBLE", "spinDirection": "DOUBLE"
            }
          },
          "hitData": {
            "launchSpeed": "DOUBLE", "launchAngle": "DOUBLE", "totalDistance": "DOUBLE", "trajectory": "VARCHAR",
            "hardness": "VARCHAR", "location": "VARCHAR", "coordinates": {"coordX": "DOUBLE", "coordY": "DOUBLE"}
          },
          "reviewDetails": {"reviewType": "VARCHAR", "isOverturned": "BOOLEAN", "challengeTeamId": "INTEGER", "player": {"id": "INTEGER"}}
        }]
      }]}
    }
  }') AS g
  FROM game_feeds
  WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]))
)
SELECT
  game_pk,
  season,
  g.gameData.datetime.officialDate AS official_date,
  coalesce(g.gameData.game.gameNumber, 1) AS game_number,
  map_values(g.gameData.teams) AS home_and_away,
  map_values(g.gameData.players) AS roster,
  g.liveData.boxscore.teams AS boxscore_teams,
  g.liveData.linescore.innings AS innings,
  g.liveData.decisions AS decisions,
  g.liveData.plays.allPlays AS all_plays,
  len(g.liveData.plays.allPlays) > 0 AS has_plays
FROM parsed;

CREATE OR REPLACE TEMP TABLE completed_plays AS
SELECT game_pk, season, play.about.atBatIndex AS at_bat_index, unnest(play)
FROM feed, unnest(all_plays) AS unnested(play)
WHERE play.about.isComplete;

DELETE FROM linescores
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM game_decisions
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM play_events
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM pitches
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM plays
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM game_players
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM game_teams
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM game_player_bios
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM player_game_batting
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

DELETE FROM player_game_pitching
WHERE game_pk IN (SELECT unnest($game_pks::INTEGER[]));

INSERT INTO plays BY NAME
WITH plays_with_ball_in_play AS (
  SELECT *,
    len(list_filter(playEvents, lambda event: event.isPitch)) AS pitch_count,
    list_last(list_filter(playEvents, lambda event: event.isPitch AND event.hitData IS NOT NULL)).hitData AS ball_in_play
  FROM completed_plays
)
SELECT
  game_pk,
  season,
  at_bat_index,
  about.inning AS inning,
  about.halfInning AS half,
  matchup.batter.id AS batter_id,
  matchup.pitcher.id AS pitcher_id,
  matchup.batSide.code AS bat_side,
  matchup.pitchHand.code AS pitch_hand,
  matchup.splits.menOnBase AS men_on_base,
  result.event AS event,
  result.eventType AS event_type,
  result.description AS description,
  result.rbi AS rbi,
  result.isOut AS is_out,
  about.isScoringPlay AS is_scoring_play,
  count.balls AS final_balls,
  count.strikes AS final_strikes,
  count.outs AS outs_after,
  result.homeScore AS home_score_after,
  result.awayScore AS away_score_after,
  pitch_count,
  ball_in_play.launchSpeed AS launch_speed,
  ball_in_play.launchAngle AS launch_angle,
  ball_in_play.totalDistance AS total_distance,
  ball_in_play.trajectory AS trajectory,
  ball_in_play.hardness AS hardness,
  ball_in_play.location AS hit_location,
  ball_in_play.coordinates.coordX AS hit_coord_x,
  ball_in_play.coordinates.coordY AS hit_coord_y,
  coalesce(about.hasReview, false) AS has_review,
  reviewDetails.reviewType AS review_type,
  reviewDetails.isOverturned AS review_overturned,
  reviewDetails.challengeTeamId AS review_challenge_team_id,
  reviewDetails.player.id AS review_player_id,
  about.startTime AS start_time,
  about.endTime AS end_time
FROM plays_with_ball_in_play;

INSERT INTO pitches BY NAME
WITH play_start AS (
  SELECT
    game_pk,
    at_bat_index,
    coalesce(lag(count.outs) OVER half_inning_in_order, 0) AS outs_before_play,
    -- The fielding team's prior PA, to credit its pitcher.
    lag(matchup) OVER fielding_team_in_order AS previous_matchup,
    list_last(list_filter(playEvents, lambda event: event.details.eventType = 'pitching_substitution')).index
      AS pitching_change_index
  FROM completed_plays
  WINDOW
    half_inning_in_order AS (PARTITION BY game_pk, about.inning, about.halfInning ORDER BY at_bat_index),
    fielding_team_in_order AS (PARTITION BY game_pk, about.halfInning ORDER BY at_bat_index)
),
events_with_count_before AS (
  SELECT
    game_pk,
    season,
    at_bat_index,
    about,
    matchup,
    reviewDetails AS play_review,
    event,
    event.index = max(event.index) FILTER (WHERE event.isPitch) OVER play_events AS is_last_pitch,
    coalesce(lag(event.count.balls) OVER play_events_in_order, 0) AS balls_before,
    coalesce(lag(event.count.strikes) OVER play_events_in_order, 0) AS strikes_before,
    coalesce(lag(event.count.outs) OVER play_events_in_order, outs_before_play) AS outs_before,
    -- Pitches before a mid-PA pitching change: old pitcher.
    CASE
      WHEN event.index < pitching_change_index THEN coalesce(previous_matchup, matchup)
      ELSE matchup
    END AS pitching_matchup
  FROM completed_plays
  JOIN play_start USING (game_pk, at_bat_index),
  unnest(playEvents) AS unnested(event)
  WINDOW
    play_events AS (PARTITION BY game_pk, at_bat_index),
    play_events_in_order AS (play_events ORDER BY event.index)
),
pitches_with_abs_challenge AS (
  SELECT *,
    -- 'MJ' = ABS challenge.
    CASE
      WHEN event.reviewDetails.reviewType = 'MJ' THEN event.reviewDetails
      WHEN is_last_pitch AND play_review.reviewType = 'MJ' THEN play_review
    END AS abs_challenge
  FROM events_with_count_before
  WHERE event.isPitch
)
SELECT
  game_pk,
  season,
  at_bat_index,
  event.index AS pitch_index,
  event.playId AS play_id,
  event.pitchNumber AS pitch_number,
  about.inning AS inning,
  about.halfInning AS half,
  matchup.batter.id AS batter_id,
  pitching_matchup.pitcher.id AS pitcher_id,
  matchup.batSide.code AS bat_side,
  pitching_matchup.pitchHand.code AS pitch_hand,
  balls_before,
  strikes_before,
  outs_before,
  event.details.type.code AS pitch_type,
  event.details.type.description AS pitch_type_desc,
  event.pitchData.typeConfidence AS type_confidence,
  event.details.call.code AS call_code,
  event.details.call.description AS call_desc,
  event.details.description AS description,
  event.details.isInPlay AS is_in_play,
  event.details.isStrike AS is_strike,
  event.details.isBall AS is_ball,
  event.details.isOut AS is_out,
  event.pitchData.startSpeed AS start_speed,
  event.pitchData.endSpeed AS end_speed,
  event.pitchData.breaks.spinRate AS spin_rate,
  event.pitchData.breaks.spinDirection AS spin_direction,
  event.pitchData.extension AS extension,
  event.pitchData.plateTime AS plate_time,
  event.pitchData.coordinates.pX AS plate_x,
  event.pitchData.coordinates.pZ AS plate_z,
  event.pitchData.coordinates.pfxX AS pfx_x,
  event.pitchData.coordinates.pfxZ AS pfx_z,
  event.pitchData.coordinates.x0 AS x0,
  event.pitchData.coordinates.y0 AS y0,
  event.pitchData.coordinates.z0 AS z0,
  event.pitchData.coordinates.vX0 AS vx0,
  event.pitchData.coordinates.vY0 AS vy0,
  event.pitchData.coordinates.vZ0 AS vz0,
  event.pitchData.coordinates.aX AS ax,
  event.pitchData.coordinates.aY AS ay,
  event.pitchData.coordinates.aZ AS az,
  event.pitchData.breaks.breakAngle AS break_angle,
  event.pitchData.breaks.breakLength AS break_length,
  event.pitchData.breaks.breakY AS break_y,
  event.pitchData.breaks.breakVertical AS break_vertical,
  event.pitchData.breaks.breakVerticalInduced AS induced_vertical_break,
  event.pitchData.breaks.breakHorizontal AS horizontal_break,
  event.pitchData.zone AS zone,
  event.pitchData.strikeZoneTop AS sz_top,
  event.pitchData.strikeZoneBottom AS sz_bottom,
  event.hitData.launchSpeed AS launch_speed,
  event.hitData.launchAngle AS launch_angle,
  event.hitData.totalDistance AS total_distance,
  event.hitData.trajectory AS trajectory,
  event.hitData.hardness AS hardness,
  event.hitData.location AS hit_location,
  abs_challenge IS NOT NULL AS abs_challenged,
  abs_challenge.isOverturned AS abs_overturned,
  abs_challenge.challengeTeamId AS abs_challenge_team_id,
  abs_challenge.player.id AS abs_challenger_id,
  event.startTime AS start_time,
  event.endTime AS end_time
FROM pitches_with_abs_challenge;

INSERT INTO play_events BY NAME
SELECT
  game_pk,
  season,
  at_bat_index,
  event.index AS event_index,
  event.type AS kind,
  event.details.eventType AS event_type,
  event.details.call.code AS call_code,
  event.details.description AS description,
  event.details.isScoringPlay AS is_scoring_play,
  event.player.id AS player_id,
  event.startTime AS start_time
FROM completed_plays, unnest(playEvents) AS unnested(event)
WHERE NOT event.isPitch;

INSERT INTO linescores BY NAME
SELECT
  game_pk,
  season,
  inning.num AS inning,
  side.half AS half,
  side.line.runs AS runs,
  side.line.hits AS hits,
  side.line.errors AS errors,
  side.line.leftOnBase AS left_on_base
FROM feed,
  unnest(innings) AS unnested(inning),
  unnest([{'half': 'top', 'line': inning.away}, {'half': 'bottom', 'line': inning.home}]) AS sides(side)
WHERE side.line IS NOT NULL;

INSERT INTO game_decisions BY NAME
SELECT
  game_pk,
  season,
  decisions.winner.id AS winner_id,
  decisions.loser.id AS loser_id,
  decisions.save.id AS save_id
FROM feed
WHERE decisions.winner IS NOT NULL;

CREATE OR REPLACE TEMP TABLE boxscore_players AS
SELECT game_pk, season, box.value.team.id AS team_id, box.key AS side, player
FROM feed,
  unnest(map_entries(boxscore_teams)) AS sides(box),
  unnest(map_values(box.value.players)) AS unnested(player)
WHERE has_plays;

INSERT INTO game_players BY NAME
SELECT
  game_pk,
  season,
  player.person.id AS player_id,
  team_id,
  side,
  player.jerseyNumber AS jersey_number,
  player.position.abbreviation AS position,
  list_transform(player.allPositions, lambda p: p.abbreviation) AS all_positions,
  player.battingOrder AS batting_order,
  player.gameStatus.isSubstitute AS is_substitute,
  player.allPositions IS NOT NULL AS played
FROM boxscore_players;

INSERT INTO player_game_batting BY NAME
WITH batting AS (
  SELECT game_pk, season, player.person.id AS player_id, team_id, player.stats.batting AS line
  FROM boxscore_players
  WHERE player.stats.batting.gamesPlayed > 0
)
SELECT
  game_pk,
  season,
  player_id,
  team_id,
  line.plateAppearances AS plate_appearances,
  line.atBats AS at_bats,
  line.runs AS runs,
  line.hits AS hits,
  line.doubles AS doubles,
  line.triples AS triples,
  line.homeRuns AS home_runs,
  line.totalBases AS total_bases,
  line.rbi AS rbi,
  line.baseOnBalls AS walks,
  line.intentionalWalks AS intentional_walks,
  line.strikeOuts AS strikeouts,
  line.hitByPitch AS hit_by_pitch,
  line.sacFlies AS sac_flies,
  line.sacBunts AS sac_bunts,
  line.stolenBases AS stolen_bases,
  line.caughtStealing AS caught_stealing,
  line.groundIntoDoublePlay AS grounded_into_double_play,
  line.leftOnBase AS left_on_base
FROM batting;

INSERT INTO player_game_pitching BY NAME
WITH pitching AS (
  SELECT game_pk, season, player.person.id AS player_id, team_id, player.stats.pitching AS line
  FROM boxscore_players
  WHERE player.stats.pitching.gamesPlayed > 0
)
SELECT
  game_pk,
  season,
  player_id,
  team_id,
  line.gamesStarted > 0 AS is_starter,
  line.outs AS outs,
  line.battersFaced AS batters_faced,
  line.numberOfPitches AS pitches,
  line.strikes AS strikes,
  line.hits AS hits,
  line.runs AS runs,
  line.earnedRuns AS earned_runs,
  line.homeRuns AS home_runs,
  line.baseOnBalls AS walks,
  line.intentionalWalks AS intentional_walks,
  line.strikeOuts AS strikeouts,
  line.hitBatsmen AS hit_batsmen,
  line.wildPitches AS wild_pitches,
  line.balks AS balks,
  line.inheritedRunners AS inherited_runners,
  line.inheritedRunnersScored AS inherited_runners_scored,
  line.wins > 0 AS is_win,
  line.losses > 0 AS is_loss,
  line.saves > 0 AS is_save,
  line.holds > 0 AS is_hold,
  line.blownSaves > 0 AS is_blown_save
FROM pitching;

INSERT INTO game_teams BY NAME
SELECT
  game_pk,
  team.id AS team_id,
  season,
  team.name AS name,
  team.teamName AS team_name,
  team.abbreviation AS abbreviation,
  team.locationName AS location_name,
  team.shortName AS short_name,
  team.teamCode AS team_code,
  team.league.id AS league_id,
  team.league.name AS league_name,
  team.division.id AS division_id,
  team.division.name AS division_name,
  team.venue.id AS venue_id,
  team.venue.name AS venue_name,
  official_date AS source_date,
  game_number AS source_game_number
FROM feed, unnest(home_and_away) AS unnested(team)
WHERE has_plays AND team.id IS NOT NULL;

INSERT INTO game_player_bios BY NAME
SELECT
  game_pk,
  player.id AS player_id,
  player.fullName AS full_name,
  player.firstName AS first_name,
  player.lastName AS last_name,
  player.boxscoreName AS boxscore_name,
  player.batSide.code AS bat_side,
  player.pitchHand.code AS pitch_hand,
  player.birthDate AS birth_date,
  player.height AS height,
  player.weight AS weight,
  player.mlbDebutDate AS mlb_debut_date,
  player.active AS active,
  player.strikeZoneTop AS sz_top,
  player.strikeZoneBottom AS sz_bottom,
  official_date AS source_date,
  game_number AS source_game_number
FROM feed, unnest(roster) AS unnested(player)
WHERE has_plays AND player.id IS NOT NULL;
