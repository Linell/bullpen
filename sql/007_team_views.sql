CREATE OR REPLACE VIEW team_plays AS
SELECT
  p.*,
  CASE p.half WHEN 'top' THEN g.away_team_id ELSE g.home_team_id END AS batting_team_id,
  CASE p.half WHEN 'top' THEN g.home_team_id ELSE g.away_team_id END AS fielding_team_id,
  g.official_date,
  g.game_type,
  g.coded_state
FROM plays p
JOIN games g USING (game_pk);

CREATE OR REPLACE VIEW team_pitches AS
SELECT
  p.*,
  CASE p.half WHEN 'top' THEN g.away_team_id ELSE g.home_team_id END AS batting_team_id,
  CASE p.half WHEN 'top' THEN g.home_team_id ELSE g.away_team_id END AS fielding_team_id,
  g.official_date,
  g.game_type,
  g.coded_state
FROM pitches p
JOIN games g USING (game_pk);
