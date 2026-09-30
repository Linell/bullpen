import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { writeAllSeasonTables } = await import("@/lib/season-tables");
const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { hittingPercentiles, pitchingPercentiles } = await import("@/lib/stats/percentiles");

const RED_SOX = 111;
const YANKEES = 147;
const FIRST_GAME = 1;
const SECOND_GAME = 2;
const SLUGGER = 500;
const TWIN = 501;
const WHIFFER = 502;
const BENCH = 503;
const ACE = 600;
const JUNK = 601;
const RELIEVER = 602;

type Play = [game: number, atBat: number, batter: number, pitcher: number, event: string, launch: number | null];

const plays: Play[] = [
  [FIRST_GAME, 0, SLUGGER, JUNK, "home_run", 110],
  [FIRST_GAME, 1, SLUGGER, JUNK, "walk", null],
  [FIRST_GAME, 2, SLUGGER, JUNK, "single", 100],
  [FIRST_GAME, 3, SLUGGER, JUNK, "strikeout", null],
  [SECOND_GAME, 0, SLUGGER, JUNK, "field_out", 100],
  [SECOND_GAME, 1, SLUGGER, JUNK, "field_out", 100],
  [FIRST_GAME, 4, TWIN, JUNK, "walk", null],
  [FIRST_GAME, 5, TWIN, JUNK, "single", 90],
  [FIRST_GAME, 6, TWIN, JUNK, "strikeout", null],
  [SECOND_GAME, 2, TWIN, JUNK, "field_out", 90],
  [SECOND_GAME, 3, TWIN, JUNK, "field_out", 90],
  [SECOND_GAME, 4, TWIN, JUNK, "field_out", 90],
  [FIRST_GAME, 7, WHIFFER, ACE, "strikeout", null],
  [FIRST_GAME, 8, WHIFFER, ACE, "strikeout", null],
  [SECOND_GAME, 5, WHIFFER, ACE, "strikeout", null],
  [SECOND_GAME, 6, WHIFFER, ACE, "field_out", 80],
  [SECOND_GAME, 7, WHIFFER, ACE, "field_out", 80],
  [FIRST_GAME, 9, BENCH, JUNK, "home_run", 120],
  [FIRST_GAME, 10, BENCH, JUNK, "home_run", 120],
  [SECOND_GAME, 8, BENCH, RELIEVER, "home_run", 120],
  [SECOND_GAME, 9, BENCH, RELIEVER, "home_run", 120],
];

type Pitch = [game: number, atBat: number, call: string, type: string, speed: number];

const pitches: Pitch[] = [
  [FIRST_GAME, 7, "S", "FF", 99],
  [FIRST_GAME, 8, "C", "FF", 99],
  [FIRST_GAME, 0, "X", "FF", 90],
  [FIRST_GAME, 3, "S", "SI", 91],
];

function playRow([game, atBat, batter, pitcher, event, launch]: Play) {
  return `(${game}, 2026, ${atBat}, 1, 'bottom', ${batter}, ${pitcher}, 'R', 'R', 'Empty', '${event}', ${launch ?? "NULL"}, 0)`;
}

function pitchRow([game, atBat, call, type, speed]: Pitch) {
  const [, , batter, pitcher] = plays.find(([g, ab]) => g === game && ab === atBat)!;
  return `(${game}, 2026, ${atBat}, 0, 1, 'bottom', ${batter}, ${pitcher}, 0, 0, 0, 5, '${call}', '${type}', ${speed}, 2300, false)`;
}

beforeAll(async () => {
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc, updated_at)
      VALUES (${FIRST_GAME}, 2026, '2026-09-20', 'R', 1, 'Final', 'F', 'Final', ${RED_SOX}, ${YANKEES}, '2026-09-20T23:05:00Z', now()),
        (${SECOND_GAME}, 2026, '2026-09-21', 'R', 1, 'Final', 'F', 'Final', ${RED_SOX}, ${YANKEES}, '2026-09-21T23:05:00Z', now())`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, pitch_hand,
        bat_side, men_on_base, event_type, launch_speed, pitch_count)
      VALUES ${plays.map(playRow).join(",")}`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id, pitcher_id,
        balls_before, strikes_before, outs_before, zone, call_code, pitch_type, start_speed, spin_rate, abs_challenged)
      VALUES ${pitches.map(pitchRow).join(",")}`);
  });
  await withConnection(writeAllSeasonTables);
});

describe("hitting percentiles", () => {
  it("ranks qualified hitters so higher is better", async () => {
    const { threshold, percentiles } = await hittingPercentiles(SLUGGER, 2026);

    expect(threshold).toBe(5);
    expect(percentiles?.exitVelocity).toEqual({ value: 102.5, percentile: 100 });
    expect(percentiles?.ops?.percentile).toBe(100);
  });

  it("flips lower-is-better stats and shares ties", async () => {
    const slugger = await hittingPercentiles(SLUGGER, 2026);
    const twin = await hittingPercentiles(TWIN, 2026);
    const whiffer = await hittingPercentiles(WHIFFER, 2026);

    expect(slugger.percentiles?.strikeoutRate?.percentile).toBe(50);
    expect(twin.percentiles?.strikeoutRate?.percentile).toBe(50);
    expect(whiffer.percentiles?.strikeoutRate).toEqual({ value: 0.6, percentile: 0 });
  });

  it("leaves out hitters below the qualifier", async () => {
    expect(await hittingPercentiles(BENCH, 2026)).toEqual({ threshold: 5 });
  });

  it("has no percentile for a stat the hitter has no data for", async () => {
    const { percentiles } = await hittingPercentiles(TWIN, 2026);

    expect(percentiles?.chaseRate).toBeNull();
  });
});

describe("pitching percentiles", () => {
  it("ranks qualified pitchers against each other", async () => {
    const ace = await pitchingPercentiles(ACE, 2026);
    const junk = await pitchingPercentiles(JUNK, 2026);

    expect(ace.threshold).toBe(3);
    expect(ace.percentiles?.strikeoutRate).toEqual({ value: 0.6, percentile: 100 });
    expect(ace.percentiles?.fastballVelocity).toEqual({ value: 99, percentile: 100 });
    expect(ace.percentiles?.hardHitRate?.percentile).toBe(100);
    expect(junk.percentiles?.strikeoutRate?.percentile).toBe(0);
    expect(junk.percentiles?.fastballVelocity?.value).toBe(90.5);
  });

  it("leaves out pitchers below the qualifier", async () => {
    expect(await pitchingPercentiles(RELIEVER, 2026)).toEqual({ threshold: 3 });
  });
});
