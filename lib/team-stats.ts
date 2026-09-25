import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { teamStatsTag } from "@/lib/cache-tags";
import { todayOfficialDate } from "@/lib/dates";

export type Rate = number | null;

export type BattingStats = {
  plateAppearances: number;
  avg: Rate;
  obp: Rate;
  slg: Rate;
  ops: Rate;
  iso: Rate;
  strikeoutRate: Rate;
  walkRate: Rate;
  homeRuns: number;
  exitVelocity: Rate;
  hardHitRate: Rate;
  chaseRate: Rate;
  zoneContactRate: Rate;
};

export type PitchingStats = {
  battersFaced: number;
  inningsPitched: number;
  ra9: Rate;
  whip: Rate;
  strikeoutRate: Rate;
  walkRate: Rate;
  whiffRate: Rate;
  cswRate: Rate;
  fastballVelocity: Rate;
};

export type TeamBatting = { team: BattingStats; league: BattingStats };

export type BattingSplits = {
  vsLeft: BattingStats;
  vsRight: BattingStats;
  home: BattingStats;
  away: BattingStats;
  risp: BattingStats;
  basesEmpty: BattingStats;
};

export type TeamPitching = {
  team: PitchingStats;
  league: PitchingStats;
  starters: PitchingStats;
  bullpen: PitchingStats;
};

export type PitchMixEntry = {
  pitchType: string;
  description: string;
  pitches: number;
  usage: Rate;
  velocity: Rate;
  whiffRate: Rate;
};

export type HitterLeader = {
  playerId: number;
  name: string;
  plateAppearances: number;
  avg: Rate;
  obp: Rate;
  slg: Rate;
  ops: Rate;
  homeRuns: number;
};

export type PitcherLeader = {
  playerId: number;
  name: string;
  battersFaced: number;
  inningsPitched: number;
  strikeoutRate: Rate;
  walkRate: Rate;
  ra9: Rate;
};

export type TeamStats = {
  batting: TeamBatting;
  battingSplits: BattingSplits;
  pitching: TeamPitching;
  pitchMix: PitchMixEntry[];
  leaders: { hitters: HitterLeader[]; pitchers: PitcherLeader[] };
};

type BattingTotals = {
  teams: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  total_bases: number;
  home_runs: number;
  walks: number;
  hit_by_pitch: number;
  sac_flies: number;
  strikeouts: number;
  batted_balls: number;
  hard_hits: number;
  exit_velocity: number | null;
  out_of_zone_pitches: number;
  chases: number;
  zone_swings: number;
  zone_contacts: number;
};

type PitchingTotals = {
  teams: number;
  batters_faced: number;
  outs: number;
  runs: number;
  hits: number;
  walks: number;
  strikeouts: number;
  pitches: number;
  swings: number;
  whiffs: number;
  called_strikes: number;
  fastball_velocity: number | null;
};

type BattingRow = BattingTotals & { scope: "team" | "league"; split: string };
type PitchingRow = PitchingTotals & { scope: "team" | "league" | "starters" | "bullpen" };
type PitchMixRow = { pitch_type: string; description: string; pitches: number; all_pitches: number; swings: number; whiffs: number; velocity: number | null };
type HitterRow = BattingTotals & { player_id: number; name: string };
type PitcherRow = PitchingTotals & { player_id: number; name: string };

const GAME_FILTER = `season = $season::INTEGER AND game_type = 'R' AND coded_state IN ('F', 'O', 'Q', 'R')`;

const PITCH_FLAGS = `
  pitch_flags AS (
    SELECT game_pk, at_bat_index, fielding_team_id, pitch_type, pitch_type_desc, start_speed, call_code,
      call_code IN ('S', 'W', 'M', 'T', 'F', 'L', 'X', 'D', 'E') AS is_swing,
      call_code IN ('S', 'W', 'M') AS is_whiff,
      zone BETWEEN 1 AND 9 AS in_zone,
      pitch_type IN ('FF', 'SI') AS is_fastball
    FROM team_pitches
    WHERE ${GAME_FILTER}
  )`;

const PLATE_APPEARANCES = `
  ${PITCH_FLAGS},
  pitch_totals AS (
    SELECT game_pk, at_bat_index,
      count(*) AS pitches,
      count(*) FILTER (is_swing) AS swings,
      count(*) FILTER (is_whiff) AS whiffs,
      count(*) FILTER (call_code = 'C') AS called_strikes,
      count(*) FILTER (NOT in_zone) AS out_of_zone_pitches,
      count(*) FILTER (NOT in_zone AND is_swing) AS chases,
      count(*) FILTER (in_zone AND is_swing) AS zone_swings,
      count(*) FILTER (in_zone AND is_swing AND NOT is_whiff) AS zone_contacts,
      count(start_speed) FILTER (is_fastball) AS fastballs,
      sum(start_speed) FILTER (is_fastball) AS fastball_speed_total
    FROM pitch_flags
    GROUP BY ALL
  ),
  scored_plays AS (
    SELECT *, CASE half WHEN 'top' THEN away_score_after ELSE home_score_after END AS batting_score
    FROM team_plays
    WHERE ${GAME_FILTER}
  ),
  plate_appearances AS (
    SELECT p.game_pk, p.batting_team_id, p.fielding_team_id, p.batter_id, p.pitcher_id, p.half, p.pitch_hand,
      p.men_on_base, p.event_type, pt.* EXCLUDE (game_pk, at_bat_index),
      p.batting_score - lag(p.batting_score, 1, 0) OVER (PARTITION BY p.game_pk, p.half ORDER BY p.at_bat_index) AS runs,
      p.outs_after - lag(p.outs_after, 1, 0) OVER (PARTITION BY p.game_pk, p.inning, p.half ORDER BY p.at_bat_index) AS outs,
      p.event_type NOT SIMILAR TO '(caught_stealing|pickoff|stolen_base|runner|other_out|other_advance|wild_pitch|passed_ball|balk|defensive_indiff|cs_double_play|game_advisory).*' AS is_pa,
      is_pa AND p.event_type NOT SIMILAR TO '(walk|intent_walk|hit_by_pitch|sac_fly|sac_bunt|catcher_interf).*' AS is_at_bat,
      CASE WHEN is_pa AND p.event_type NOT SIMILAR TO '(strikeout|walk|intent_walk|hit_by_pitch|catcher_interf).*' THEN p.launch_speed END AS launch_speed,
      CASE p.event_type WHEN 'single' THEN 1 WHEN 'double' THEN 2 WHEN 'triple' THEN 3 WHEN 'home_run' THEN 4 ELSE 0 END AS bases,
      p.event_type IN ('walk', 'intent_walk') AS is_walk,
      p.event_type LIKE 'strikeout%' AS is_strikeout,
      s.pitcher_id IS NOT NULL AS by_starter
    FROM scored_plays p
    LEFT JOIN pitch_totals pt USING (game_pk, at_bat_index)
    LEFT JOIN game_starters s ON s.game_pk = p.game_pk AND s.pitcher_id = p.pitcher_id
  )`;

const BATTING_TOTALS = `
  count(*) FILTER (is_pa) AS plate_appearances,
  count(*) FILTER (is_at_bat) AS at_bats,
  count(*) FILTER (bases > 0) AS hits,
  sum(bases) AS total_bases,
  count(*) FILTER (event_type = 'home_run') AS home_runs,
  count(*) FILTER (is_walk) AS walks,
  count(*) FILTER (event_type = 'hit_by_pitch') AS hit_by_pitch,
  count(*) FILTER (event_type LIKE 'sac_fly%') AS sac_flies,
  count(*) FILTER (is_strikeout) AS strikeouts,
  count(launch_speed) AS batted_balls,
  count(*) FILTER (launch_speed >= 95) AS hard_hits,
  avg(launch_speed) AS exit_velocity,
  sum(out_of_zone_pitches) AS out_of_zone_pitches,
  sum(chases) AS chases,
  sum(zone_swings) AS zone_swings,
  sum(zone_contacts) AS zone_contacts`;

const PITCHING_TOTALS = `
  count(*) FILTER (is_pa) AS batters_faced,
  sum(outs) AS outs,
  sum(runs) AS runs,
  count(*) FILTER (bases > 0) AS hits,
  count(*) FILTER (is_walk) AS walks,
  count(*) FILTER (is_strikeout) AS strikeouts,
  sum(pitches) AS pitches,
  sum(swings) AS swings,
  sum(whiffs) AS whiffs,
  sum(called_strikes) AS called_strikes,
  sum(fastball_speed_total) / sum(fastballs) AS fastball_velocity`;

function withNumbers(query: string, labels: string[]) {
  return `SELECT ${labels.join(", ")}, COLUMNS(* EXCLUDE (${labels.join(", ")}))::DOUBLE FROM (${query})`;
}

const BATTING_QUERY = withNumbers(
  `WITH ${PLATE_APPEARANCES},
  splits AS (
    SELECT *, unnest([
      'all',
      'vs_' || pitch_hand::VARCHAR,
      CASE half WHEN 'bottom' THEN 'home' ELSE 'away' END,
      CASE WHEN men_on_base IN ('RISP', 'Loaded') THEN 'risp' WHEN men_on_base = 'Empty' THEN 'bases_empty' END
    ]) AS split
    FROM plate_appearances
  )
  SELECT split,
    CASE grouping(batting_team_id) WHEN 1 THEN 'league' ELSE 'team' END AS scope,
    greatest(count(DISTINCT batting_team_id), 1) AS teams,
    ${BATTING_TOTALS}
  FROM splits
  WHERE split IS NOT NULL
  GROUP BY GROUPING SETS ((split, batting_team_id), (split))
  HAVING grouping(batting_team_id) = 1 OR batting_team_id = $teamId::INTEGER`,
  ["split", "scope"],
);

const PITCHING_QUERY = withNumbers(
  `WITH ${PLATE_APPEARANCES}
  SELECT
    CASE
      WHEN grouping(fielding_team_id) = 1 THEN 'league'
      WHEN grouping(by_starter) = 1 THEN 'team'
      WHEN by_starter THEN 'starters'
      ELSE 'bullpen'
    END AS scope,
    greatest(count(DISTINCT fielding_team_id), 1) AS teams,
    ${PITCHING_TOTALS}
  FROM plate_appearances
  GROUP BY GROUPING SETS ((fielding_team_id, by_starter), (fielding_team_id), ())
  HAVING grouping(fielding_team_id) = 1 OR fielding_team_id = $teamId::INTEGER`,
  ["scope"],
);

const PITCH_MIX_QUERY = withNumbers(
  `WITH ${PITCH_FLAGS}
  SELECT pitch_type,
    any_value(pitch_type_desc) AS description,
    count(*) AS pitches,
    sum(count(*)) OVER () AS all_pitches,
    count(*) FILTER (is_swing) AS swings,
    count(*) FILTER (is_whiff) AS whiffs,
    avg(start_speed) AS velocity
  FROM pitch_flags
  WHERE fielding_team_id = $teamId::INTEGER AND pitch_type IS NOT NULL
  GROUP BY pitch_type
  ORDER BY pitches DESC`,
  ["pitch_type", "description"],
);

function leadersQuery(role: "batter" | "pitcher", totals: string, orderBy: string) {
  const team = role === "batter" ? "batting_team_id" : "fielding_team_id";
  return withNumbers(
    `WITH ${PLATE_APPEARANCES}
    SELECT pa.${role}_id AS player_id,
      coalesce(any_value(pl.full_name), 'Player ' || pa.${role}_id::VARCHAR) AS name,
      ${totals}
    FROM plate_appearances pa
    LEFT JOIN players pl ON pl.player_id = pa.${role}_id
    WHERE pa.${team} = $teamId::INTEGER
    GROUP BY pa.${role}_id
    ORDER BY ${orderBy} DESC, pa.${role}_id
    LIMIT 5`,
    ["player_id", "name"],
  );
}

const HITTERS_QUERY = leadersQuery("batter", BATTING_TOTALS, "plate_appearances");
const PITCHERS_QUERY = leadersQuery("pitcher", PITCHING_TOTALS, "batters_faced");

const NO_BATTING: BattingTotals = {
  teams: 1,
  plate_appearances: 0,
  at_bats: 0,
  hits: 0,
  total_bases: 0,
  home_runs: 0,
  walks: 0,
  hit_by_pitch: 0,
  sac_flies: 0,
  strikeouts: 0,
  batted_balls: 0,
  hard_hits: 0,
  exit_velocity: null,
  out_of_zone_pitches: 0,
  chases: 0,
  zone_swings: 0,
  zone_contacts: 0,
};

const NO_PITCHING: PitchingTotals = {
  teams: 1,
  batters_faced: 0,
  outs: 0,
  runs: 0,
  hits: 0,
  walks: 0,
  strikeouts: 0,
  pitches: 0,
  swings: 0,
  whiffs: 0,
  called_strikes: 0,
  fastball_velocity: null,
};

function ratio(numerator: number, denominator: number): Rate {
  return denominator > 0 ? numerator / denominator : null;
}

function sum(a: Rate, b: Rate): Rate {
  return a === null || b === null ? null : a + b;
}

function toSlashLine(t: BattingTotals) {
  const avg = ratio(t.hits, t.at_bats);
  const obp = ratio(t.hits + t.walks + t.hit_by_pitch, t.at_bats + t.walks + t.hit_by_pitch + t.sac_flies);
  const slg = ratio(t.total_bases, t.at_bats);
  return { avg, obp, slg, ops: sum(obp, slg) };
}

function toBattingStats(t: BattingTotals = NO_BATTING): BattingStats {
  const slashLine = toSlashLine(t);
  return {
    plateAppearances: t.plate_appearances / t.teams,
    ...slashLine,
    iso: slashLine.slg === null || slashLine.avg === null ? null : slashLine.slg - slashLine.avg,
    strikeoutRate: ratio(t.strikeouts, t.plate_appearances),
    walkRate: ratio(t.walks, t.plate_appearances),
    homeRuns: t.home_runs / t.teams,
    exitVelocity: t.exit_velocity,
    hardHitRate: ratio(t.hard_hits, t.batted_balls),
    chaseRate: ratio(t.chases, t.out_of_zone_pitches),
    zoneContactRate: ratio(t.zone_contacts, t.zone_swings),
  };
}

function toPitchingStats(t: PitchingTotals = NO_PITCHING): PitchingStats {
  return {
    battersFaced: t.batters_faced / t.teams,
    inningsPitched: t.outs / 3 / t.teams,
    ra9: ratio(t.runs * 27, t.outs),
    whip: ratio((t.hits + t.walks) * 3, t.outs),
    strikeoutRate: ratio(t.strikeouts, t.batters_faced),
    walkRate: ratio(t.walks, t.batters_faced),
    whiffRate: ratio(t.whiffs, t.swings),
    cswRate: ratio(t.called_strikes + t.whiffs, t.pitches),
    fastballVelocity: t.fastball_velocity,
  };
}

function toPitchMixEntry(r: PitchMixRow): PitchMixEntry {
  return {
    pitchType: r.pitch_type,
    description: r.description,
    pitches: r.pitches,
    usage: ratio(r.pitches, r.all_pitches),
    velocity: r.velocity,
    whiffRate: ratio(r.whiffs, r.swings),
  };
}

function toHitterLeader(r: HitterRow): HitterLeader {
  return {
    playerId: r.player_id,
    name: r.name,
    plateAppearances: r.plate_appearances,
    ...toSlashLine(r),
    homeRuns: r.home_runs,
  };
}

function toPitcherLeader(r: PitcherRow): PitcherLeader {
  const { battersFaced, inningsPitched, strikeoutRate, walkRate, ra9 } = toPitchingStats({ ...r, teams: 1 });
  return { playerId: r.player_id, name: r.name, battersFaced, inningsPitched, strikeoutRate, walkRate, ra9 };
}

function isPastSeason(season: number) {
  return season < Number(todayOfficialDate().slice(0, 4));
}

export async function getTeamStats(teamId: number, season: number): Promise<TeamStats> {
  "use cache: remote";
  cacheTag(teamStatsTag(teamId));
  if (isPastSeason(season)) cacheLife("max");
  else cacheLife("hours");

  const params = { teamId, season };
  const [batting, pitching, pitchMix, hitters, pitchers] = await Promise.all([
    readRows<BattingRow>(BATTING_QUERY, params),
    readRows<PitchingRow>(PITCHING_QUERY, params),
    readRows<PitchMixRow>(PITCH_MIX_QUERY, params),
    readRows<HitterRow>(HITTERS_QUERY, params),
    readRows<PitcherRow>(PITCHERS_QUERY, params),
  ]);

  const battingFor = (scope: BattingRow["scope"], split: string) =>
    toBattingStats(batting.find((r) => r.scope === scope && r.split === split));
  const pitchingFor = (scope: PitchingRow["scope"]) => toPitchingStats(pitching.find((r) => r.scope === scope));

  return {
    batting: { team: battingFor("team", "all"), league: battingFor("league", "all") },
    battingSplits: {
      vsLeft: battingFor("team", "vs_L"),
      vsRight: battingFor("team", "vs_R"),
      home: battingFor("team", "home"),
      away: battingFor("team", "away"),
      risp: battingFor("team", "risp"),
      basesEmpty: battingFor("team", "bases_empty"),
    },
    pitching: {
      team: pitchingFor("team"),
      league: pitchingFor("league"),
      starters: pitchingFor("starters"),
      bullpen: pitchingFor("bullpen"),
    },
    pitchMix: pitchMix.map(toPitchMixEntry),
    leaders: { hitters: hitters.map(toHitterLeader), pitchers: pitchers.map(toPitcherLeader) },
  };
}
