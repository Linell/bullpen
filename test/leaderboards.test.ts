import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { cacheTag } = await import("next/cache");
const { refreshGameDayRollups, writeAllSeasonRollups } = await import("@/lib/season-rollups");
const { readRows, withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { barrelRates, fastestPitches, hardestHitBalls, hittingLeaders, longestHomeRuns, pitchingLeaders, whiffRates } =
  await import("@/lib/stats/leaderboards");

const RED_SOX = 111;
const YANKEES = 147;
const TODAY = 1;
const POSTSEASON = 2;
const LIVE = 3;
const YESTERDAY = 4;
const SPRING = 5;
const SLUGGER = 500;
const CONTACT = 501;
const DRIFTER = 502;
const FLAMETHROWER = 600;
const SOFTTOSSER = 601;
const RAREARM = 602;

type Game = [game: number, date: string, type: string, state: string];

const games: Game[] = [
  [TODAY, "2026-09-28", "R", "F"],
  [POSTSEASON, "2026-09-28", "F", "F"],
  [LIVE, "2026-09-28", "R", "I"],
  [YESTERDAY, "2026-09-27", "R", "F"],
  [SPRING, "2026-09-28", "S", "F"],
];

type Play = [
  game: number,
  atBat: number,
  batter: number,
  pitcher: number,
  event: string,
  eventType: string,
  distance: number | null,
  launch: [speed: number, angle: number],
];

const plays: Play[] = [
  [TODAY, 0, SLUGGER, SOFTTOSSER, "Home Run", "home_run", 410, [104, 28]],
  [TODAY, 1, CONTACT, SOFTTOSSER, "Single", "single", null, [98.7, 25]],
  [TODAY, 2, DRIFTER, SOFTTOSSER, "Flyout", "field_out", null, [100, 30]],
  [POSTSEASON, 0, CONTACT, FLAMETHROWER, "Home Run", "home_run", 452, [102.3, 30]],
  [POSTSEASON, 1, SLUGGER, FLAMETHROWER, "Home Run", "home_run", null, [95, 30]],
  [LIVE, 0, SLUGGER, FLAMETHROWER, "Home Run", "home_run", 430, [110, 30]],
  [YESTERDAY, 0, SLUGGER, FLAMETHROWER, "Home Run", "home_run", 480, [118, 30]],
  [SPRING, 0, SLUGGER, FLAMETHROWER, "Home Run", "home_run", 500, [120, 30]],
];

type Pitch = [
  game: number,
  atBat: number,
  index: number,
  count: string,
  speed: number | null,
  type: string | null,
  call: string,
  callDesc: string,
  zone: number,
  launch?: [speed: number, angle: number],
  pitcher?: number,
];

const FOUR_SEAM = "Four-Seam Fastball";
const SLIDER = "Slider";
const CHANGEUP = "Changeup";

const IN_PLAY = "In play, no out";

function bulk(game: number, pitcher: number, calls: string): Pitch[] {
  return [...calls].map((call, i) => [game, pitcher, i, "0-0", 90, FOUR_SEAM, call, call, 5, undefined, pitcher]);
}

const pitches: Pitch[] = [
  [TODAY, 0, 0, "0-0", 88.5, FOUR_SEAM, "S", "Swinging Strike", 12, [115, 10]],
  [TODAY, 0, 1, "0-1", 90.1, SLIDER, "X", IN_PLAY, 5, [104, 28]],
  [TODAY, 1, 0, "1-2", 91.4, FOUR_SEAM, "X", IN_PLAY, 5, [98.7, 25]],
  [TODAY, 2, 0, "0-0", 85, CHANGEUP, "X", IN_PLAY, 5, [100, 30]],
  [POSTSEASON, 0, 0, "2-2", 101.8, FOUR_SEAM, "X", IN_PLAY, 5, [102.3, 30]],
  [POSTSEASON, 1, 0, "0-0", null, null, "C", "Called Strike", 5],
  [POSTSEASON, 1, 1, "0-1", 100.5, FOUR_SEAM, "S", "Swinging Strike", 5],
  [LIVE, 0, 0, "0-2", 99.2, SLIDER, "X", IN_PLAY, 5, [110, 30]],
  [YESTERDAY, 0, 0, "3-2", 103.5, FOUR_SEAM, "X", IN_PLAY, 5, [118, 30]],
  [SPRING, 0, 0, "0-0", 105, FOUR_SEAM, "X", IN_PLAY, 5, [120, 30]],
  ...bulk(POSTSEASON, FLAMETHROWER, "SSCCBBBBBB"),
  ...bulk(TODAY, SOFTTOSSER, "SSSSSCBBBB"),
  ...bulk(POSTSEASON, RAREARM, "SSSSS"),
  ...bulk(YESTERDAY, FLAMETHROWER, "CCCCCCCCCC"),
];

type BattingLine = [
  game: number,
  player: number,
  pa: number,
  ab: number,
  hits: number,
  totalBases: number,
  homeRuns: number,
  walks: number,
  strikeouts: number,
];

const battingLines: BattingLine[] = [
  [TODAY, SLUGGER, 4, 3, 2, 5, 1, 1, 1],
  [SPRING, SLUGGER, 5, 5, 5, 20, 5, 0, 0],
  [TODAY, CONTACT, 2, 2, 1, 1, 0, 0, 0],
  [LIVE, CONTACT, 3, 3, 2, 5, 1, 0, 1],
  [TODAY, DRIFTER, 3, 3, 0, 0, 0, 0, 2],
  [YESTERDAY, DRIFTER, 5, 5, 5, 5, 0, 0, 0],
];

type PitchingLine = [
  game: number,
  player: number,
  outs: number,
  battersFaced: number,
  hits: number,
  earnedRuns: number,
  walks: number,
  strikeouts: number,
];

const pitchingLines: PitchingLine[] = [
  [TODAY, SOFTTOSSER, 9, 12, 3, 1, 1, 4],
  [POSTSEASON, FLAMETHROWER, 6, 8, 1, 0, 1, 3],
  [SPRING, FLAMETHROWER, 3, 8, 5, 5, 0, 0],
  [POSTSEASON, RAREARM, 2, 3, 0, 0, 0, 2],
  [YESTERDAY, RAREARM, 10, 12, 1, 0, 0, 5],
];

const TODAY_RANGE = { from: "2026-09-28", to: "2026-09-28", limit: 10 };
const TWO_DAYS = { from: "2026-09-27", to: "2026-09-28", limit: 10 };

function gameRow([game, date, type, state]: Game) {
  return `(${game}, 2026, '${date}', '${type}', 1, 'Final', '${state}', 'Final', ${RED_SOX}, ${YANKEES}, '${date}T23:05:00Z', now())`;
}

function playRow([game, atBat, batter, pitcher, event, eventType, distance, [speed, angle]]: Play) {
  return `(${game}, 2026, ${atBat}, 1, 'bottom', ${batter}, ${pitcher}, '${event}', '${eventType}', ${distance ?? "NULL"},
    ${speed}, ${angle}, 0)`;
}

function pitchRow([game, atBat, index, count, speed, type, call, callDesc, zone, launch, pitcher]: Pitch) {
  const play = plays.find(([g, ab]) => g === game && ab === atBat);
  const [balls, strikes] = count.split("-");
  return `(${game}, 2026, ${atBat}, ${index}, 1, 'bottom', ${play?.[2] ?? 0}, ${play?.[3] ?? pitcher}, ${balls}, ${strikes}, 0,
    ${speed ?? "NULL"}, ${type ? `'${type}'` : "NULL"}, '${call}', '${callDesc}', ${zone}, ${call === "X"},
    ${launch?.[0] ?? "NULL"}, ${launch?.[1] ?? "NULL"}, false)`;
}

function battingRow([game, player, pa, ab, hits, totalBases, homeRuns, walks, strikeouts]: BattingLine) {
  return `(${game}, 2026, ${player}, ${RED_SOX}, ${pa}, ${ab}, 0, ${hits}, 0, 0, ${homeRuns}, ${totalBases}, 0,
    ${walks}, 0, ${strikeouts}, 0, 0, 0, 0, 0, 0, 0)`;
}

function pitchingRow([game, player, outs, battersFaced, hits, earnedRuns, walks, strikeouts]: PitchingLine) {
  return `(${game}, 2026, ${player}, ${YANKEES}, false, ${outs}, ${battersFaced}, 0, 0, ${hits}, ${earnedRuns},
    ${earnedRuns}, 0, ${walks}, 0, ${strikeouts}, 0, 0, 0, 0, 0, false, false, false, false, false)`;
}

function teamRow(game: number) {
  return `(${game}, ${RED_SOX}, 2026, 'Boston Red Sox', 'BOS', '2026-09-28', 1),
    (${game}, ${YANKEES}, 2026, 'New York Yankees', 'NYY', '2026-09-28', 1)`;
}

beforeAll(async () => {
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
    await conn.run(`INSERT INTO game_teams (game_pk, team_id, season, name, abbreviation, source_date, source_game_number)
      VALUES ${[TODAY, POSTSEASON, LIVE].map(teamRow).join(",")}`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, event, event_type,
        total_distance, launch_speed, launch_angle, pitch_count)
      VALUES ${plays.map(playRow).join(",")}`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id, pitcher_id,
        balls_before, strikes_before, outs_before, start_speed, pitch_type_desc, call_code, call_desc, zone, is_in_play,
        launch_speed, launch_angle, abs_challenged)
      VALUES ${pitches.map(pitchRow).join(",")}`);
    await conn.run(`INSERT INTO player_game_batting VALUES ${battingLines.map(battingRow).join(",")}`);
    await conn.run(`INSERT INTO player_game_pitching VALUES ${pitchingLines.map(pitchingRow).join(",")}`);
    await conn.run(`INSERT INTO game_player_bios (player_id, full_name, game_pk, source_date, source_game_number)
      VALUES (${SLUGGER}, 'Sam Slugger', ${TODAY}, '2026-09-28', 1),
        (${CONTACT}, 'Cal Contact', ${TODAY}, '2026-09-28', 1),
        (${DRIFTER}, 'Dan Drifter', ${TODAY}, '2026-09-28', 1),
        (${FLAMETHROWER}, 'Fay Flamethrower', ${POSTSEASON}, '2026-09-28', 1),
        (${SOFTTOSSER}, 'Sid Softtosser', ${TODAY}, '2026-09-28', 1)`);
  });
  await withConnection(writeAllSeasonRollups);
});

describe("leaderboard caching", () => {
  it("tags each season the range touches and the range's last day", async () => {
    vi.mocked(cacheTag).mockClear();
    await longestHomeRuns({ from: "2025-12-30", to: "2026-01-02", limit: 10 });
    await pitchingLeaders(TODAY_RANGE);

    expect(cacheTag).toHaveBeenNthCalledWith(1, "season-rollups:2025", "season-rollups:2026", "day:2026-01-02");
    expect(cacheTag).toHaveBeenNthCalledWith(2, "season-rollups:2026", "day:2026-09-28");
  });
});

describe("game day rollups", () => {
  it("rebuilds one game's day to match the season rebuild", async () => {
    const before = await Promise.all([longestHomeRuns(TODAY_RANGE), fastestPitches(TODAY_RANGE), barrelRates(TODAY_RANGE)]);

    await withConnection(async (conn) => {
      await conn.run("DELETE FROM event_leaders; DELETE FROM batted_ball_days; DELETE FROM pitch_outcome_days");
      await refreshGameDayRollups(conn, LIVE);
    });

    const after = await Promise.all([longestHomeRuns(TODAY_RANGE), fastestPitches(TODAY_RANGE), barrelRates(TODAY_RANGE)]);
    expect(after).toEqual(before);
    await withConnection((conn) => writeAllSeasonRollups(conn));
  });
});

describe("event leaderboards", () => {
  it("ranks home runs by distance across finished, postseason and in-progress games but not spring training", async () => {
    const leaders = await longestHomeRuns(TODAY_RANGE);

    expect(leaders.map((l) => [l.gamePk, l.value])).toEqual([
      [POSTSEASON, 452],
      [LIVE, 430],
      [TODAY, 410],
    ]);
  });

  it("describes the pitch behind each event", async () => {
    const [first] = await longestHomeRuns(TODAY_RANGE);

    expect(first).toEqual({
      player: { id: CONTACT, name: "Cal Contact" },
      opponent: { id: FLAMETHROWER, name: "Fay Flamethrower" },
      value: 452,
      pitchType: FOUR_SEAM,
      count: "2-2",
      result: "Home Run",
      gamePk: POSTSEASON,
      date: "2026-09-28",
      matchup: "NYY @ BOS",
    });
  });

  it("ranks pitches by velocity, credits the pitcher and reports the call when not in play", async () => {
    const leaders = await fastestPitches({ ...TODAY_RANGE, limit: 3 });

    expect(leaders.map((l) => [l.player.id, l.opponent.id, l.value, l.count, l.result])).toEqual([
      [FLAMETHROWER, CONTACT, 101.8, "2-2", "Home Run"],
      [FLAMETHROWER, SLUGGER, 100.5, "0-1", "Swinging Strike"],
      [FLAMETHROWER, SLUGGER, 99.2, "0-2", "Home Run"],
    ]);
  });

  it("ranks balls in play by exit velocity, ignores fouls and credits the batter", async () => {
    const leaders = await hardestHitBalls(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.value, l.pitchType])).toEqual([
      [SLUGGER, 110, SLIDER],
      [SLUGGER, 104, SLIDER],
      [CONTACT, 102.3, FOUR_SEAM],
      [DRIFTER, 100, CHANGEUP],
      [CONTACT, 98.7, FOUR_SEAM],
    ]);
  });

  it("spans any date range and honors the limit", async () => {
    const leaders = await longestHomeRuns({ ...TWO_DAYS, limit: 2 });

    expect(leaders.map((l) => [l.gamePk, l.value, l.matchup])).toEqual([
      [YESTERDAY, 480, "Away @ Home"],
      [POSTSEASON, 452, "NYY @ BOS"],
    ]);
  });

  it("is empty before any games in the range have data", async () => {
    expect(await fastestPitches({ from: "2026-09-29", to: "2026-09-29", limit: 10 })).toEqual([]);
  });
});

describe("hittingLeaders", () => {
  it("ranks batters by OPS across finished, postseason and in-progress games but not spring training", async () => {
    const leaders = await hittingLeaders(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.plateAppearances, l.homeRuns])).toEqual([
      [SLUGGER, 4, 1],
      [CONTACT, 5, 1],
    ]);
    expect(leaders[1]).toMatchObject({
      avg: 0.6,
      obp: 0.6,
      slg: 1.2,
      strikeoutRate: 0.2,
      walkRate: 0,
    });
    expect(leaders[0].ops).toBeCloseTo(0.75 + 5 / 3);
  });

  it("requires 3.1 plate appearances per game day in the range", async () => {
    const leaders = await hittingLeaders(TWO_DAYS);

    expect(leaders.map((l) => [l.player.id, l.plateAppearances, l.avg])).toEqual([[DRIFTER, 8, 0.625]]);
  });

  it("honors the limit", async () => {
    expect(await hittingLeaders({ ...TODAY_RANGE, limit: 1 })).toHaveLength(1);
  });
});

describe("pitchingLeaders", () => {
  it("ranks pitchers by ERA, lowest first", async () => {
    const leaders = await pitchingLeaders(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.inningsPitched, l.era])).toEqual([
      [FLAMETHROWER, 2, 0],
      [SOFTTOSSER, 3, 3],
    ]);
    expect(leaders[1]).toMatchObject({
      strikeouts: 4,
      strikeoutRate: 1 / 3,
      walkRate: 1 / 12,
    });
    expect(leaders[1].whip).toBeCloseTo(4 / 3);
  });

  it("requires one inning per game day in the range and breaks ties by innings", async () => {
    const leaders = await pitchingLeaders(TWO_DAYS);

    expect(leaders.map((l) => [l.player, l.era])).toEqual([
      [{ id: RAREARM, name: `Player ${RAREARM}` }, 0],
      [{ id: FLAMETHROWER, name: "Fay Flamethrower" }, 0],
      [{ id: SOFTTOSSER, name: "Sid Softtosser" }, 3],
    ]);
  });

  it("honors the limit", async () => {
    expect(await pitchingLeaders({ ...TODAY_RANGE, limit: 1 })).toHaveLength(1);
  });
});

describe("barrelRates", () => {
  it("ranks batters by barrels per batted ball", async () => {
    const leaders = await barrelRates(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.battedBalls, l.barrelRate, l.hardHitRate])).toEqual([
      [DRIFTER, 1, 1, 1],
      [SLUGGER, 3, 2 / 3, 1],
      [CONTACT, 2, 0.5, 1],
    ]);
    expect(leaders[1].exitVelocity).toBeCloseTo(103);
  });

  it("requires one batted ball per game day in the range", async () => {
    const leaders = await barrelRates(TWO_DAYS);

    expect(leaders.map((l) => [l.player.id, l.battedBalls, l.barrelRate])).toEqual([
      [SLUGGER, 4, 0.75],
      [CONTACT, 2, 0.5],
    ]);
  });

  it("honors the limit", async () => {
    expect(await barrelRates({ ...TODAY_RANGE, limit: 1 })).toHaveLength(1);
  });
});

describe("whiffRates", () => {
  it("ranks pitchers by whiffs per swing", async () => {
    const leaders = await whiffRates(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.pitches, l.whiffRate])).toEqual([
      [SOFTTOSSER, 14, 2 / 3],
      [FLAMETHROWER, 14, 0.6],
    ]);
    expect(leaders[1].cswRate).toBeCloseTo(6 / 14);
  });

  it("requires ten pitches per game day in the range", async () => {
    const leaders = await whiffRates(TWO_DAYS);

    expect(leaders.map((l) => [l.player.id, l.pitches, l.whiffRate])).toEqual([[FLAMETHROWER, 25, 0.5]]);
  });

  it("honors the limit", async () => {
    expect(await whiffRates({ ...TODAY_RANGE, limit: 1 })).toHaveLength(1);
  });
});

describe("is_barrel", () => {
  it.each([
    [98, 26, true],
    [98, 25, false],
    [105, 40, true],
    [116, 50, true],
    [97.9, 28, false],
  ])("gives %s mph at %s degrees %s", async (speed, angle, expected) => {
    const [row] = await readRows<{ barrel: boolean }>("SELECT is_barrel($speed::DOUBLE, $angle::DOUBLE) AS barrel", { speed, angle });

    expect(row.barrel).toBe(expected);
  });
});
