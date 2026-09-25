import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readRows } from "@/lib/db";
import { teamStatsTag } from "@/lib/cache-tags";
import type { WinLoss } from "@/lib/team-summary";

export type RunDiffPoint = {
  gamePk: number;
  date: string;
  runDiff: number;
  cumulative: number;
  rolling10: number;
};

export type SituationalRecords = {
  oneRun: WinLoss;
  extraInnings: WinLoss;
  blowouts: WinLoss;
  scoringFirst: WinLoss;
  comebackWins: number;
  blownLeads: number;
};

export type InningRuns = {
  inning: number | "extras";
  scored: number;
  allowed: number;
};

export type AbsChallenges = {
  challenges: number;
  overturned: number;
  overturnRate?: number;
  opponentChallenges: number;
  opponentOverturned: number;
};

export type RelieverWorkload = {
  pitcherId: number;
  name: string;
  last3Days: number;
  last7Days: number;
};

export type TeamTrends = {
  runDiffByGame: RunDiffPoint[];
  situational: SituationalRecords;
  runsByInning: InningRuns[];
  absChallenges: AbsChallenges;
  bullpenWorkload?: RelieverWorkload[];
};

const TEAM_GAMES = `
  team_games AS (
    SELECT game_pk, official_date, start_utc, game_number, inning,
      home_team_id = $teamId::INTEGER AS is_home,
      CASE WHEN home_team_id = $teamId::INTEGER THEN home_score ELSE away_score END AS runs_for,
      CASE WHEN home_team_id = $teamId::INTEGER THEN away_score ELSE home_score END AS runs_against
    FROM games
    WHERE season = $season::INTEGER
      AND game_type = 'R'
      AND coded_state IN ('F', 'O', 'Q', 'R')
      AND $teamId::INTEGER IN (home_team_id, away_team_id)
  )`;

const RUN_DIFF_QUERY = `
  WITH ${TEAM_GAMES}
  SELECT game_pk, strftime(official_date, '%Y-%m-%d') AS date,
    runs_for - runs_against AS run_diff,
    sum(runs_for - runs_against) OVER (ORDER BY start_utc, game_number ROWS UNBOUNDED PRECEDING)::INTEGER AS cumulative,
    sum(runs_for - runs_against) OVER (ORDER BY start_utc, game_number ROWS 9 PRECEDING)::INTEGER AS rolling_10
  FROM team_games
  ORDER BY start_utc, game_number`;

const SITUATIONAL_QUERY = `
  WITH ${TEAM_GAMES},
  game_flow AS (
    SELECT p.game_pk,
      bool_or(CASE WHEN tg.is_home THEN p.home_score_after < p.away_score_after
        ELSE p.away_score_after < p.home_score_after END) AS trailed,
      bool_or(CASE WHEN tg.is_home THEN p.home_score_after > p.away_score_after
        ELSE p.away_score_after > p.home_score_after END) AS led,
      arg_min(p.batting_team_id = $teamId::INTEGER, p.at_bat_index)
        FILTER (WHERE p.home_score_after + p.away_score_after > 0) AS scored_first
    FROM team_plays p
    JOIN team_games tg USING (game_pk)
    GROUP BY p.game_pk
  ),
  results AS (
    SELECT tg.*, runs_for > runs_against AS won, abs(runs_for - runs_against) AS margin, f.trailed, f.led, f.scored_first
    FROM team_games tg
    LEFT JOIN game_flow f USING (game_pk)
  )
  SELECT
    count(*) FILTER (WHERE margin = 1 AND won)::INTEGER AS one_run_wins,
    count(*) FILTER (WHERE margin = 1 AND NOT won)::INTEGER AS one_run_losses,
    count(*) FILTER (WHERE inning > 9 AND won)::INTEGER AS extra_wins,
    count(*) FILTER (WHERE inning > 9 AND NOT won)::INTEGER AS extra_losses,
    count(*) FILTER (WHERE margin >= 5 AND won)::INTEGER AS blowout_wins,
    count(*) FILTER (WHERE margin >= 5 AND NOT won)::INTEGER AS blowout_losses,
    count(*) FILTER (WHERE scored_first AND won)::INTEGER AS scoring_first_wins,
    count(*) FILTER (WHERE scored_first AND NOT won)::INTEGER AS scoring_first_losses,
    count(*) FILTER (WHERE trailed AND won)::INTEGER AS comeback_wins,
    count(*) FILTER (WHERE led AND NOT won)::INTEGER AS blown_leads
  FROM results`;

const RUNS_BY_INNING_QUERY = `
  WITH ${TEAM_GAMES}
  SELECT least(l.inning, 10) AS inning,
    coalesce(sum(l.runs) FILTER (WHERE (l.half = 'bottom') = tg.is_home), 0)::INTEGER AS scored,
    coalesce(sum(l.runs) FILTER (WHERE (l.half = 'bottom') <> tg.is_home), 0)::INTEGER AS allowed
  FROM linescores l
  JOIN team_games tg USING (game_pk)
  GROUP BY 1
  ORDER BY 1`;

const ABS_CHALLENGES_QUERY = `
  WITH ${TEAM_GAMES}
  SELECT
    count(*) FILTER (WHERE abs_challenge_team_id = $teamId::INTEGER)::INTEGER AS challenges,
    count(*) FILTER (WHERE abs_challenge_team_id = $teamId::INTEGER AND abs_overturned)::INTEGER AS overturned,
    count(*) FILTER (WHERE abs_challenge_team_id <> $teamId::INTEGER)::INTEGER AS opponent_challenges,
    count(*) FILTER (WHERE abs_challenge_team_id <> $teamId::INTEGER AND abs_overturned)::INTEGER AS opponent_overturned
  FROM pitches
  JOIN team_games USING (game_pk)
  WHERE abs_challenged`;

const BULLPEN_WORKLOAD_QUERY = `
  WITH ${TEAM_GAMES},
  latest AS (SELECT max(official_date) AS day FROM team_games)
  SELECT p.pitcher_id,
    coalesce(pl.boxscore_name, pl.full_name, 'Player ' || p.pitcher_id::VARCHAR) AS name,
    count(*) FILTER (WHERE p.official_date > latest.day - 3)::INTEGER AS last_3_days,
    count(*)::INTEGER AS last_7_days
  FROM team_pitches p
  JOIN team_games USING (game_pk)
  CROSS JOIN latest
  LEFT JOIN game_starters s ON s.game_pk = p.game_pk AND s.pitcher_id = p.pitcher_id
  LEFT JOIN players pl ON pl.player_id = p.pitcher_id
  WHERE p.fielding_team_id = $teamId::INTEGER
    AND s.pitcher_id IS NULL
    AND p.official_date > latest.day - 7
  GROUP BY ALL
  ORDER BY last_3_days DESC, last_7_days DESC, name`;

type RunDiffRow = { game_pk: number; date: string; run_diff: number; cumulative: number; rolling_10: number };

type SituationalRow = {
  one_run_wins: number;
  one_run_losses: number;
  extra_wins: number;
  extra_losses: number;
  blowout_wins: number;
  blowout_losses: number;
  scoring_first_wins: number;
  scoring_first_losses: number;
  comeback_wins: number;
  blown_leads: number;
};

type InningRunsRow = { inning: number; scored: number; allowed: number };

type AbsChallengesRow = {
  challenges: number;
  overturned: number;
  opponent_challenges: number;
  opponent_overturned: number;
};

type WorkloadRow = { pitcher_id: number; name: string; last_3_days: number; last_7_days: number };

function toSituational(row: SituationalRow): SituationalRecords {
  return {
    oneRun: { wins: row.one_run_wins, losses: row.one_run_losses },
    extraInnings: { wins: row.extra_wins, losses: row.extra_losses },
    blowouts: { wins: row.blowout_wins, losses: row.blowout_losses },
    scoringFirst: { wins: row.scoring_first_wins, losses: row.scoring_first_losses },
    comebackWins: row.comeback_wins,
    blownLeads: row.blown_leads,
  };
}

function toAbsChallenges(row: AbsChallengesRow): AbsChallenges {
  return {
    challenges: row.challenges,
    overturned: row.overturned,
    overturnRate: row.challenges > 0 ? row.overturned / row.challenges : undefined,
    opponentChallenges: row.opponent_challenges,
    opponentOverturned: row.opponent_overturned,
  };
}

export async function getTeamTrends(
  teamId: number,
  season: number,
  { isCurrentSeason }: { isCurrentSeason: boolean },
): Promise<TeamTrends> {
  "use cache: remote";
  cacheTag(teamStatsTag(teamId));
  if (isCurrentSeason) cacheLife("hours");
  else cacheLife("max");

  const params = { teamId, season };
  const [runDiff, [situational], innings, [abs], workload] = await Promise.all([
    readRows<RunDiffRow>(RUN_DIFF_QUERY, params),
    readRows<SituationalRow>(SITUATIONAL_QUERY, params),
    readRows<InningRunsRow>(RUNS_BY_INNING_QUERY, params),
    readRows<AbsChallengesRow>(ABS_CHALLENGES_QUERY, params),
    isCurrentSeason ? readRows<WorkloadRow>(BULLPEN_WORKLOAD_QUERY, params) : undefined,
  ]);

  return {
    runDiffByGame: runDiff.map((r) => ({
      gamePk: r.game_pk,
      date: r.date,
      runDiff: r.run_diff,
      cumulative: r.cumulative,
      rolling10: r.rolling_10,
    })),
    situational: toSituational(situational),
    runsByInning: innings.map((r) => ({
      inning: r.inning > 9 ? "extras" : r.inning,
      scored: r.scored,
      allowed: r.allowed,
    })),
    absChallenges: toAbsChallenges(abs),
    bullpenWorkload: workload?.map((r) => ({
      pitcherId: r.pitcher_id,
      name: r.name,
      last3Days: r.last_3_days,
      last7Days: r.last_7_days,
    })),
  };
}
