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
  battedBalls: number;
  exitVelocity: Rate;
  hardHitRate: Rate;
  chaseRate: Rate;
  zoneContactRate: Rate;
};

export type PitchingStats = {
  battersFaced: number;
  inningsPitched: number;
  era: Rate;
  ra9: Rate;
  whip: Rate;
  strikeoutRate: Rate;
  walkRate: Rate;
  whiffRate: Rate;
  cswRate: Rate;
  fastballVelocity: Rate;
};

export type BattingCounts = {
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
};

export type SwingDecisionCounts = {
  out_of_zone_pitches: number;
  chases: number;
  zone_swings: number;
  zone_contacts: number;
};

export type PitchingCounts = {
  batters_faced: number;
  outs: number;
  runs: number;
  earned_runs: number;
  hits: number;
  walks: number;
  strikeouts: number;
};

export type PitchCounts = {
  pitches: number;
  swings: number;
  whiffs: number;
  called_strikes: number;
  fastball_velocity: number | null;
};

export type BattingTotals = BattingCounts & SwingDecisionCounts & { teams: number };
export type PitchingTotals = PitchingCounts & PitchCounts & { teams: number };

export const NO_BATTING: BattingTotals = {
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

export const NO_PITCHING: PitchingTotals = {
  teams: 1,
  batters_faced: 0,
  outs: 0,
  runs: 0,
  earned_runs: 0,
  hits: 0,
  walks: 0,
  strikeouts: 0,
  pitches: 0,
  swings: 0,
  whiffs: 0,
  called_strikes: 0,
  fastball_velocity: null,
};

export function ratio(numerator: number, denominator: number): Rate {
  return denominator > 0 ? numerator / denominator : null;
}

function sum(a: Rate, b: Rate): Rate {
  return a === null || b === null ? null : a + b;
}

export function toSlashLine(t: BattingCounts) {
  const avg = ratio(t.hits, t.at_bats);
  const obp = ratio(t.hits + t.walks + t.hit_by_pitch, t.at_bats + t.walks + t.hit_by_pitch + t.sac_flies);
  const slg = ratio(t.total_bases, t.at_bats);
  return { avg, obp, slg, ops: sum(obp, slg) };
}

export function toBattingStats(t: BattingTotals): BattingStats {
  const slashLine = toSlashLine(t);
  return {
    plateAppearances: t.plate_appearances / t.teams,
    ...slashLine,
    iso: slashLine.slg === null || slashLine.avg === null ? null : slashLine.slg - slashLine.avg,
    strikeoutRate: ratio(t.strikeouts, t.plate_appearances),
    walkRate: ratio(t.walks, t.plate_appearances),
    homeRuns: t.home_runs / t.teams,
    battedBalls: t.batted_balls / t.teams,
    exitVelocity: t.exit_velocity,
    hardHitRate: ratio(t.hard_hits, t.batted_balls),
    chaseRate: ratio(t.chases, t.out_of_zone_pitches),
    zoneContactRate: ratio(t.zone_contacts, t.zone_swings),
  };
}

export function toPitchingStats(t: PitchingTotals): PitchingStats {
  return {
    battersFaced: t.batters_faced / t.teams,
    inningsPitched: t.outs / 3 / t.teams,
    era: ratio(t.earned_runs * 27, t.outs),
    ra9: ratio(t.runs * 27, t.outs),
    whip: ratio((t.hits + t.walks) * 3, t.outs),
    strikeoutRate: ratio(t.strikeouts, t.batters_faced),
    walkRate: ratio(t.walks, t.batters_faced),
    whiffRate: ratio(t.whiffs, t.swings),
    cswRate: ratio(t.called_strikes + t.whiffs, t.pitches),
    fastballVelocity: t.fastball_velocity,
  };
}
