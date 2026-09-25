import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { getTeamStats } = await import("@/lib/team-stats");

const HOME = 110;
const AWAY = 141;
const FINAL = 1;
const IN_PROGRESS = 2;
const SPRING = 3;
const STARTER = 40;
const RELIEVER = 41;

type Play = [
  game: number,
  atBat: number,
  half: "top" | "bottom",
  batter: number,
  pitcher: number,
  hand: "L" | "R",
  menOn: string,
  event: string,
  launch: number | null,
  outs: number,
  awayScore: number,
];

const plays: Play[] = [
  [FINAL, 0, "top", 10, STARTER, "R", "Empty", "home_run", 105, 0, 1],
  [FINAL, 1, "top", 11, STARTER, "R", "Empty", "strikeout", null, 1, 1],
  [FINAL, 2, "top", 12, STARTER, "R", "Empty", "walk", null, 1, 1],
  [FINAL, 3, "top", 13, RELIEVER, "R", "Men_On", "field_out", 80, 2, 1],
  [FINAL, 4, "top", 14, RELIEVER, "R", "Men_On", "double", 98, 2, 2],
  [FINAL, 5, "top", 10, RELIEVER, "R", "RISP", "strikeout", null, 3, 2],
  [FINAL, 6, "bottom", 30, 20, "L", "Empty", "single", 90, 0, 2],
  [FINAL, 7, "bottom", 31, 20, "L", "Men_On", "grounded_into_double_play", 85, 2, 2],
  [FINAL, 8, "bottom", 32, 20, "L", "Empty", "triple", 100, 2, 2],
  [FINAL, 9, "bottom", 33, 20, "L", "RISP", "strikeout", null, 3, 2],
  [IN_PROGRESS, 0, "bottom", 30, 20, "L", "Empty", "home_run", 110, 0, 0],
  [SPRING, 0, "bottom", 30, 20, "L", "Empty", "home_run", 110, 0, 0],
];

type Pitch = [atBat: number, index: number, zone: number, call: string, type: string, speed: number];

const pitches: Pitch[] = [
  [6, 0, 5, "X", "FF", 95],
  [7, 0, 12, "S", "SL", 85],
  [7, 1, 4, "X", "FF", 97],
  [8, 0, 13, "B", "SL", 87],
  [8, 1, 2, "D", "FF", 96],
  [9, 0, 5, "C", "CH", 88],
  [9, 1, 11, "S", "SL", 86],
  [9, 2, 3, "S", "FF", 94],
];

function playRow([game, atBat, half, batter, pitcher, hand, menOn, event, launch, outs, awayScore]: Play) {
  return `(${game}, 2026, ${atBat}, 1, '${half}', ${batter}, ${pitcher}, '${hand}', '${menOn}', '${event}',
    ${launch ?? "NULL"}, ${outs}, 0, ${awayScore}, 1)`;
}

function pitchRow([atBat, index, zone, call, type, speed]: Pitch) {
  return `(${FINAL}, 2026, ${atBat}, ${index}, 1, 'bottom', 0, 20, 0, 0, 0, ${zone}, '${call}', '${type}', ${speed}, false)`;
}

beforeAll(async () => {
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc, updated_at)
      VALUES (${FINAL}, 2026, '2026-09-20', 'R', 1, 'Final', 'F', 'Final', ${HOME}, ${AWAY}, '2026-09-20T23:05:00Z', now()),
        (${IN_PROGRESS}, 2026, '2026-09-21', 'R', 1, 'Live', 'I', 'In Progress', ${HOME}, ${AWAY}, '2026-09-21T23:05:00Z', now()),
        (${SPRING}, 2026, '2026-03-01', 'S', 1, 'Final', 'F', 'Final', ${HOME}, ${AWAY}, '2026-03-01T20:05:00Z', now())`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, pitch_hand,
        men_on_base, event_type, launch_speed, outs_after, home_score_after, away_score_after, pitch_count)
      VALUES ${plays.map(playRow).join(",")}`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id,
        pitcher_id, balls_before, strikes_before, outs_before, zone, call_code, pitch_type, start_speed, abs_challenged)
      VALUES ${pitches.map(pitchRow).join(",")}`);
    await conn.run(`INSERT INTO players (player_id, season, full_name, source_game_pk, source_date, source_game_number)
      VALUES (${STARTER}, 2026, 'Sam Starter', 1, '2026-09-20', 1), (10, 2026, 'Lead Off', 1, '2026-09-20', 1)`);
  });
});

describe("getTeamStats", () => {
  it("builds a batting line from completed regular-season games only", async () => {
    const { batting } = await getTeamStats(HOME, 2026);

    expect(batting.team).toMatchObject({ plateAppearances: 4, avg: 0.5, obp: 0.5, slg: 1, ops: 1.5, iso: 0.5, homeRuns: 0 });
    expect(batting.team.strikeoutRate).toBe(0.25);
    expect(batting.team.chaseRate).toBeCloseTo(2 / 3);
    expect(batting.team.zoneContactRate).toBe(0.75);
    expect(batting.team.exitVelocity).toBeCloseTo(275 / 3);
  });

  it("pairs each batting stat with the league average", async () => {
    const { batting } = await getTeamStats(AWAY, 2026);

    expect(batting.team).toMatchObject({ plateAppearances: 6, avg: 0.4, obp: 0.5, homeRuns: 1 });
    expect(batting.team.slg).toBeCloseTo(1.2);
    expect(batting.team.hardHitRate).toBeCloseTo(2 / 3);
    expect(batting.league).toMatchObject({ plateAppearances: 5, homeRuns: 0.5, walkRate: 0.1 });
    expect(batting.league.avg).toBeCloseTo(4 / 9);
  });

  it("splits batting by pitcher hand, venue and base state", async () => {
    const { battingSplits } = await getTeamStats(HOME, 2026);

    expect(battingSplits.vsLeft.plateAppearances).toBe(4);
    expect(battingSplits.vsRight.plateAppearances).toBe(0);
    expect(battingSplits.home.plateAppearances).toBe(4);
    expect(battingSplits.away.avg).toBeNull();
    expect(battingSplits.risp).toMatchObject({ plateAppearances: 1, strikeoutRate: 1 });
    expect(battingSplits.basesEmpty).toMatchObject({ plateAppearances: 2, avg: 1 });
  });

  it("charges runs and outs to starters and the bullpen", async () => {
    const { pitching } = await getTeamStats(HOME, 2026);

    expect(pitching.team).toMatchObject({ battersFaced: 6, inningsPitched: 1, ra9: 18, whip: 3 });
    expect(pitching.team.strikeoutRate).toBeCloseTo(1 / 3);
    expect(pitching.starters).toMatchObject({ battersFaced: 3, ra9: 27 });
    expect(pitching.bullpen).toMatchObject({ battersFaced: 3, ra9: 13.5 });
    expect(pitching.league).toMatchObject({ battersFaced: 5, inningsPitched: 1, ra9: 9 });
  });

  it("measures swing-and-miss and velocity from the pitches thrown", async () => {
    const { pitching, pitchMix } = await getTeamStats(AWAY, 2026);

    expect(pitching.team).toMatchObject({ ra9: 0, whiffRate: 0.5, cswRate: 0.5, fastballVelocity: 95.5 });
    expect(pitchMix.map((p) => [p.pitchType, p.pitches, p.usage])).toEqual([
      ["FF", 4, 0.5],
      ["SL", 3, 0.375],
      ["CH", 1, 0.125],
    ]);
    expect(pitchMix[0]).toMatchObject({ velocity: 95.5, whiffRate: 0.25 });
    expect(pitchMix[1].whiffRate).toBe(1);
  });

  it("lists the busiest hitters and pitchers", async () => {
    const away = await getTeamStats(AWAY, 2026);
    const home = await getTeamStats(HOME, 2026);

    expect(away.leaders.hitters[0]).toMatchObject({ playerId: 10, name: "Lead Off", plateAppearances: 2, homeRuns: 1, avg: 0.5 });
    expect(home.leaders.pitchers.map((p) => [p.name, p.battersFaced, p.ra9])).toEqual([
      ["Sam Starter", 3, 27],
      [`Player ${RELIEVER}`, 3, 13.5],
    ]);
  });

  it("returns empty stats for a season without games", async () => {
    const stats = await getTeamStats(HOME, 2025);

    expect(stats.batting.team).toMatchObject({ plateAppearances: 0, avg: null });
    expect(stats.pitching.league.ra9).toBeNull();
    expect(stats.pitchMix).toEqual([]);
    expect(stats.leaders.hitters).toEqual([]);
  });
});
