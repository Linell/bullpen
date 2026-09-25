import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { getTeamTrends } = await import("@/lib/team-trends");

const HOME = 110;
const AWAY = 141;
const OTHER = 147;
const STREAKY = 158;
const RELIEVER = 501;

type Seed = {
  gamePk: number;
  date: string;
  home: number;
  away: number;
  score: [home: number, away: number];
  season?: number;
  gameType?: string;
  codedState?: string;
  inning?: number;
};

function gameRow({ gamePk, date, home, away, score, season = 2026, gameType = "R", codedState = "F", inning = 9 }: Seed) {
  return `(${gamePk}, ${season}, '${date}', '${gameType}', 1, 'Final', '${codedState}', 'Final', ${home}, ${away},
    ${score[0]}, ${score[1]}, ${inning}, '${date}T23:05:00Z', now())`;
}

type Play = [gamePk: number, atBat: number, inning: number, half: string, pitcher: number, home: number, away: number];

const PLAYS: Play[] = [
  [1, 0, 1, "top", 500, 0, 1],
  [1, 1, 1, "bottom", 900, 2, 1],
  [1, 2, 5, "top", RELIEVER, 2, 4],
  [1, 3, 7, "bottom", 900, 5, 4],
  [2, 0, 1, "top", 901, 0, 2],
  [2, 1, 1, "bottom", 510, 0, 2],
  [2, 2, 9, "bottom", 502, 2, 2],
  [2, 3, 10, "bottom", RELIEVER, 3, 2],
];

type Pitch = [gamePk: number, atBat: number, pitchIndex: number, challengeTeam?: number, overturned?: boolean];

const PITCHES: Pitch[] = [
  [1, 0, 0, HOME, true],
  [1, 1, 0, HOME, false],
  [1, 2, 0, AWAY, true],
  [1, 3, 0],
  [2, 0, 0],
  [2, 1, 0],
  [2, 2, 0],
  [2, 3, 0],
  [2, 3, 1],
  [2, 3, 2],
  [4, 0, 0, HOME, true],
];

function playRow([gamePk, atBat, inning, half, pitcher, home, away]: Play) {
  return `(${gamePk}, 2026, ${atBat}, ${inning}, '${half}', 1, ${pitcher}, 1, ${home}, ${away})`;
}

function pitchRow([gamePk, atBat, pitchIndex, challengeTeam, overturned]: Pitch) {
  const play = PLAYS.find((p) => p[0] === gamePk && p[1] === atBat) ?? [gamePk, atBat, 1, "top", 500];
  return `(${gamePk}, 2026, ${atBat}, ${pitchIndex}, ${play[2]}, '${play[3]}', 1, ${play[4]}, 0, 0, 0,
    ${challengeTeam !== undefined}, ${overturned ?? "NULL"}, ${challengeTeam ?? "NULL"})`;
}

beforeAll(async () => {
  const games: Seed[] = [
    { gamePk: 1, date: "2026-09-18", home: HOME, away: AWAY, score: [5, 4] },
    { gamePk: 2, date: "2026-09-20", home: AWAY, away: HOME, score: [3, 2], inning: 10 },
    { gamePk: 3, date: "2026-09-22", home: HOME, away: OTHER, score: [8, 1] },
    { gamePk: 4, date: "2026-10-01", home: HOME, away: AWAY, score: [1, 0], gameType: "F" },
    { gamePk: 5, date: "2026-09-23", home: HOME, away: AWAY, score: [0, 0], codedState: "I" },
    { gamePk: 6, date: "2025-09-22", home: HOME, away: AWAY, score: [0, 9], season: 2025 },
    ...Array.from({ length: 12 }, (_, i) => ({
      gamePk: 100 + i,
      date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      home: STREAKY,
      away: OTHER,
      score: [i + 1, 0] as [number, number],
    })),
  ];
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number, abstract_state,
        coded_state, detailed_state, home_team_id, away_team_id, home_score, away_score, inning, start_utc, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id,
        pitch_count, home_score_after, away_score_after)
      VALUES ${PLAYS.map(playRow).join(",")}`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id,
        pitcher_id, balls_before, strikes_before, outs_before, abs_challenged, abs_overturned, abs_challenge_team_id)
      VALUES ${PITCHES.map(pitchRow).join(",")}`);
    await conn.run(`INSERT INTO linescores (game_pk, season, inning, half, runs)
      VALUES (1, 2026, 1, 'top', 1), (1, 2026, 1, 'bottom', 2), (1, 2026, 5, 'top', 3), (1, 2026, 7, 'bottom', 3),
        (2, 2026, 1, 'top', 2), (2, 2026, 9, 'bottom', 2), (2, 2026, 10, 'bottom', 1),
        (3, 2026, 3, 'bottom', 8), (3, 2026, 4, 'top', 1), (4, 2026, 1, 'bottom', 1)`);
    await conn.run(`INSERT INTO players (player_id, season, full_name, boxscore_name, source_game_pk, source_date,
        source_game_number)
      VALUES (${RELIEVER}, 2026, 'Luke Weaver', 'Weaver', 1, '2026-09-18', 1)`);
  });
});

describe("getTeamTrends", () => {
  it("tracks cumulative and rolling run differential across completed regular-season games", async () => {
    const { runDiffByGame } = await getTeamTrends(HOME, 2026, { isCurrentSeason: false });

    expect(runDiffByGame).toEqual([
      { gamePk: 1, date: "2026-09-18", runDiff: 1, cumulative: 1, rolling10: 1 },
      { gamePk: 2, date: "2026-09-20", runDiff: -1, cumulative: 0, rolling10: 0 },
      { gamePk: 3, date: "2026-09-22", runDiff: 7, cumulative: 7, rolling10: 7 },
    ]);
  });

  it("limits the rolling run differential to the last ten games", async () => {
    const { runDiffByGame } = await getTeamTrends(STREAKY, 2026, { isCurrentSeason: false });
    const last = runDiffByGame.at(-1);

    expect(last?.cumulative).toBe(78);
    expect(last?.rolling10).toBe(75);
  });

  it("builds situational records from scores and play-by-play", async () => {
    const { situational } = await getTeamTrends(HOME, 2026, { isCurrentSeason: false });

    expect(situational).toEqual({
      oneRun: { wins: 1, losses: 1 },
      extraInnings: { wins: 0, losses: 1 },
      blowouts: { wins: 1, losses: 0 },
      scoringFirst: { wins: 0, losses: 1 },
      comebackWins: 1,
      blownLeads: 1,
    });
  });

  it("splits runs scored and allowed by inning with extras grouped", async () => {
    const { runsByInning } = await getTeamTrends(HOME, 2026, { isCurrentSeason: false });

    expect(runsByInning).toEqual([
      { inning: 1, scored: 4, allowed: 1 },
      { inning: 3, scored: 8, allowed: 0 },
      { inning: 4, scored: 0, allowed: 1 },
      { inning: 5, scored: 0, allowed: 3 },
      { inning: 7, scored: 3, allowed: 0 },
      { inning: 9, scored: 0, allowed: 2 },
      { inning: "extras", scored: 0, allowed: 1 },
    ]);
  });

  it("counts ABS challenges by the team and against it", async () => {
    const { absChallenges } = await getTeamTrends(HOME, 2026, { isCurrentSeason: false });

    expect(absChallenges).toEqual({
      challenges: 2,
      overturned: 1,
      overturnRate: 0.5,
      opponentChallenges: 1,
      opponentOverturned: 1,
    });
  });

  it("reports reliever pitch counts relative to the latest game for the current season", async () => {
    const { bullpenWorkload } = await getTeamTrends(HOME, 2026, { isCurrentSeason: true });

    expect(bullpenWorkload).toEqual([
      { pitcherId: RELIEVER, name: "Weaver", last3Days: 3, last7Days: 4 },
      { pitcherId: 502, name: "Player 502", last3Days: 1, last7Days: 1 },
    ]);
  });

  it("skips bullpen workload for past seasons", async () => {
    const { bullpenWorkload } = await getTeamTrends(HOME, 2026, { isCurrentSeason: false });

    expect(bullpenWorkload).toBeUndefined();
  });
});
