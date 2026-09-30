import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { refreshAllSeasonRollups } = await import("./season-rollups");
const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { playerCacheTags } = await import("@/lib/cache-tags");
const { hitterGameLog, hitterSeason, hitterSplits, hitterSprayChart, hitterYears } = await import("@/lib/stats/hitting");
const { leagueArsenal, pitcherArsenal, pitcherGameLog, pitcherSeason, pitcherSplits, pitcherYears } = await import("@/lib/stats/pitching");
const { playerSummary } = await import("@/lib/stats/player");

const RED_SOX = 111;
const YANKEES = 147;
const AT_HOME = 1;
const ON_ROAD = 2;
const LAST_YEAR = 3;
const SPRING = 4;
const HITTER = 500;
const PITCHER = 600;
const LEFTY = 700;
const UNKNOWN = 999;

type Game = [game: number, season: number, date: string, type: string, home: number, away: number];

const games: Game[] = [
  [AT_HOME, 2026, "2026-09-20", "R", RED_SOX, YANKEES],
  [ON_ROAD, 2026, "2026-09-21", "R", YANKEES, RED_SOX],
  [LAST_YEAR, 2025, "2025-09-20", "R", RED_SOX, YANKEES],
  [SPRING, 2026, "2026-03-01", "S", RED_SOX, YANKEES],
];

type Play = [
  game: number,
  atBat: number,
  half: "top" | "bottom",
  batter: number,
  pitcher: number,
  pitchHand: "L" | "R",
  batSide: "L" | "R",
  menOn: string,
  event: string,
  launch: number | null,
];

const plays: Play[] = [
  [AT_HOME, 0, "bottom", HITTER, PITCHER, "R", "L", "Empty", "home_run", 105],
  [AT_HOME, 1, "bottom", HITTER, PITCHER, "R", "L", "RISP", "strikeout", null],
  [AT_HOME, 2, "bottom", 501, PITCHER, "R", "R", "Empty", "walk", null],
  [ON_ROAD, 0, "top", HITTER, PITCHER, "R", "L", "Men_On", "single", 90],
  [ON_ROAD, 1, "top", HITTER, LEFTY, "L", "L", "Empty", "field_out", 80],
  [LAST_YEAR, 0, "bottom", HITTER, PITCHER, "R", "L", "Empty", "double", 100],
  [SPRING, 0, "bottom", HITTER, PITCHER, "R", "L", "Empty", "home_run", 110],
];

type Pitch = [game: number, atBat: number, index: number, zone: number, call: string, type: string, speed: number, spin: number];

const pitches: Pitch[] = [
  [AT_HOME, 0, 0, 12, "S", "SL", 85, 2400],
  [AT_HOME, 0, 1, 5, "X", "FF", 96, 2300],
  [AT_HOME, 1, 0, 4, "S", "FF", 95, 2250],
  [AT_HOME, 1, 1, 13, "B", "SL", 86, 2500],
  [ON_ROAD, 0, 0, 5, "C", "FF", 97, 2350],
  [LAST_YEAR, 0, 0, 5, "X", "FF", 94, 2200],
];

type BattingLine = [game: number, pa: number, ab: number, hits: number, totalBases: number, homeRuns: number, strikeouts: number];

const battingLines: BattingLine[] = [
  [AT_HOME, 2, 2, 1, 4, 1, 1],
  [ON_ROAD, 2, 2, 1, 1, 0, 0],
  [LAST_YEAR, 1, 1, 1, 2, 0, 0],
  [SPRING, 1, 1, 1, 4, 1, 0],
];

type PitchingLine = [
  game: number,
  isStarter: boolean,
  outs: number,
  battersFaced: number,
  hits: number,
  earnedRuns: number,
  walks: number,
  strikeouts: number,
  isWin: boolean,
  isHold: boolean,
];

const pitchingLines: PitchingLine[] = [
  [AT_HOME, true, 3, 3, 1, 1, 1, 1, true, false],
  [ON_ROAD, false, 1, 1, 1, 0, 0, 0, false, true],
  [LAST_YEAR, true, 3, 1, 1, 0, 0, 0, false, false],
];

type Appearance = [game: number, player: number, team: number, side: "home" | "away", number: string, position: string];

const appearances: Appearance[] = [
  [LAST_YEAR, HITTER, RED_SOX, "home", "7", "RF"],
  [AT_HOME, HITTER, RED_SOX, "home", "12", "CF"],
  [ON_ROAD, HITTER, RED_SOX, "away", "12", "LF"],
  [SPRING, HITTER, RED_SOX, "home", "99", "1B"],
  [AT_HOME, PITCHER, YANKEES, "away", "45", "P"],
];

function seasonOf(game: number) {
  return games.find(([g]) => g === game)![1];
}

function gameRow([game, season, date, type, home, away]: Game) {
  return `(${game}, ${season}, '${date}', '${type}', 1, 'Final', 'F', 'Final', ${home}, ${away}, '${date}T23:05:00Z', now())`;
}

function playRow([game, atBat, half, batter, pitcher, pitchHand, batSide, menOn, event, launch]: Play) {
  const season = seasonOf(game);
  return `(${game}, ${season}, ${atBat}, 1, '${half}', ${batter}, ${pitcher}, '${pitchHand}', '${batSide}', '${menOn}',
    '${event}', ${launch ?? "NULL"}, 0)`;
}

function pitchRow([game, atBat, index, zone, call, type, speed, spin]: Pitch) {
  const season = seasonOf(game);
  const [, , half, batter, pitcher] = plays.find(([g, ab]) => g === game && ab === atBat)!;
  return `(${game}, ${season}, ${atBat}, ${index}, 1, '${half}', ${batter}, ${pitcher}, 0, 0, 0, ${zone}, '${call}',
    '${type}', ${speed}, ${spin}, false)`;
}

function battingRow([game, pa, ab, hits, totalBases, homeRuns, strikeouts]: BattingLine) {
  const season = seasonOf(game);
  return `(${game}, ${season}, ${HITTER}, ${RED_SOX}, ${pa}, ${ab}, 0, ${hits}, 0, 0, ${homeRuns}, ${totalBases}, 0,
    0, 0, ${strikeouts}, 0, 0, 0, 0, 0, 0, 0)`;
}

function pitchingRow([game, isStarter, outs, battersFaced, hits, earnedRuns, walks, strikeouts, isWin, isHold]: PitchingLine) {
  const season = seasonOf(game);
  return `(${game}, ${season}, ${PITCHER}, ${YANKEES}, ${isStarter}, ${outs}, ${battersFaced}, 0, 0, ${hits}, ${earnedRuns},
    ${earnedRuns}, 0, ${walks}, 0, ${strikeouts}, 0, 0, 0, 0, 0, ${isWin}, false, false, ${isHold}, false)`;
}

function appearanceRow([game, player, team, side, number, position]: Appearance) {
  const season = seasonOf(game);
  return `(${game}, ${season}, ${player}, ${team}, '${side}', '${number}', '${position}', true)`;
}

beforeAll(async () => {
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc, updated_at)
      VALUES ${games.map(gameRow).join(",")}`);
    await conn.run(`INSERT INTO game_teams (game_pk, team_id, season, name, abbreviation, source_date, source_game_number)
      VALUES (${AT_HOME}, ${RED_SOX}, 2026, 'Boston Red Sox', 'BOS', '2026-09-20', 1),
        (${AT_HOME}, ${YANKEES}, 2026, 'New York Yankees', 'NYY', '2026-09-20', 1)`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, pitch_hand,
        bat_side, men_on_base, event_type, launch_speed, pitch_count)
      VALUES ${plays.map(playRow).join(",")}`);
    await conn.run(`UPDATE plays SET hit_coord_x = 100 + at_bat_index, hit_coord_y = 150 + game_pk`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id, pitcher_id,
        balls_before, strikes_before, outs_before, zone, call_code, pitch_type, start_speed, spin_rate, abs_challenged)
      VALUES ${pitches.map(pitchRow).join(",")}`);
    await conn.run(`UPDATE pitches SET pitch_hand = 'R', induced_vertical_break = start_speed - 80,
      horizontal_break = CASE pitch_type WHEN 'FF' THEN 8 ELSE -4 END`);
    await conn.run(`INSERT INTO player_game_batting VALUES ${battingLines.map(battingRow).join(",")}`);
    await conn.run(`INSERT INTO player_game_pitching VALUES ${pitchingLines.map(pitchingRow).join(",")}`);
    await conn.run(`INSERT INTO game_players (game_pk, season, player_id, team_id, side, jersey_number, position, played)
      VALUES ${appearances.map(appearanceRow).join(",")}`);
    await conn.run(`INSERT INTO game_player_bios (player_id, full_name, bat_side, pitch_hand, game_pk, source_date,
        source_game_number)
      VALUES (${HITTER}, 'Hal Hitter', 'L', 'R', ${ON_ROAD}, '2026-09-21', 1),
        (${PITCHER}, 'Pat Pitcher', 'R', 'R', ${AT_HOME}, '2026-09-20', 1)`);
  });
  await withConnection(refreshAllSeasonRollups);
});

describe("hitter stats", () => {
  it("combines the box score line with batted balls and swing decisions", async () => {
    const stats = await hitterSeason(HITTER, 2026);

    expect(stats).toMatchObject({ plateAppearances: 4, avg: 0.5, obp: 0.5, slg: 1.25, homeRuns: 1, strikeoutRate: 0.25 });
    expect(stats.exitVelocity).toBeCloseTo(275 / 3);
    expect(stats.hardHitRate).toBeCloseTo(1 / 3);
    expect(stats).toMatchObject({ chaseRate: 0.5, zoneContactRate: 0.5 });
  });

  it("splits plate appearances by pitcher hand, venue and base state", async () => {
    const splits = await hitterSplits(HITTER, 2026);

    expect(splits.vsRight.plateAppearances).toBe(3);
    expect(splits.vsLeft).toMatchObject({ plateAppearances: 1, avg: 0 });
    expect(splits.home.plateAppearances).toBe(2);
    expect(splits.away).toMatchObject({ plateAppearances: 2, avg: 0.5 });
    expect(splits.risp).toMatchObject({ plateAppearances: 1, strikeoutRate: 1 });
    expect(splits.basesEmpty).toMatchObject({ plateAppearances: 2, homeRuns: 1 });
  });

  it("plots this season's balls in play, hits last", async () => {
    const spray = await hitterSprayChart(HITTER, 2026);

    expect(spray).toEqual([
      { x: 101, y: 152, bases: 0 },
      { x: 100, y: 152, bases: 1 },
      { x: 100, y: 151, bases: 4 },
    ]);
  });

  it("logs each regular-season game with its opponent", async () => {
    const log = await hitterGameLog(HITTER, 2026);

    expect(log).toEqual([
      expect.objectContaining({ gamePk: AT_HOME, date: "2026-09-20", isHome: true, opponentId: YANKEES, opponent: "NYY", homeRuns: 1 }),
      expect.objectContaining({ gamePk: ON_ROAD, date: "2026-09-21", isHome: false, opponentId: YANKEES, opponent: null, hits: 1 }),
    ]);
  });

  it("lists one line per season", async () => {
    const years = await hitterYears(HITTER);

    expect(years.map((y) => [y.season, y.stats.plateAppearances, y.stats.slg])).toEqual([
      [2025, 1, 2],
      [2026, 4, 1.25],
    ]);
    expect(years[0].stats.exitVelocity).toBe(100);
  });
});

describe("pitcher stats", () => {
  it("combines box score outs and runs with the pitches thrown", async () => {
    const stats = await pitcherSeason(PITCHER, 2026);

    expect(stats).toMatchObject({ battersFaced: 4, era: 6.75, strikeoutRate: 0.25, fastballVelocity: 96 });
    expect(stats.inningsPitched).toBeCloseTo(4 / 3);
    expect(stats.whiffRate).toBeCloseTo(2 / 3);
    expect(stats.cswRate).toBeCloseTo(3 / 5);
  });

  it("splits batters faced by batter side and venue", async () => {
    const splits = await pitcherSplits(PITCHER, 2026);

    expect(splits.vsLeft).toMatchObject({ plateAppearances: 3, avg: 2 / 3 });
    expect(splits.vsRight).toMatchObject({ plateAppearances: 1, walkRate: 1 });
    expect(splits.home.plateAppearances).toBe(1);
    expect(splits.away.plateAppearances).toBe(3);
  });

  it("logs starts, decisions and the line for each game", async () => {
    const log = await pitcherGameLog(PITCHER, 2026);

    expect(log).toEqual([
      expect.objectContaining({ gamePk: AT_HOME, isHome: false, opponent: "BOS", isStarter: true, decisions: ["W"], inningsPitched: 1 }),
      expect.objectContaining({ gamePk: ON_ROAD, isHome: true, opponentId: RED_SOX, isStarter: false, decisions: ["H"] }),
    ]);
  });

  it("lists one line per season", async () => {
    const years = await pitcherYears(PITCHER);

    expect(years.map((y) => [y.season, y.stats.battersFaced, y.stats.era])).toEqual([
      [2025, 1, 0],
      [2026, 4, 6.75],
    ]);
  });

  it("breaks down the arsenal with velocity and spin", async () => {
    const arsenal = await pitcherArsenal(PITCHER, 2026);

    expect(arsenal.map((p) => [p.pitchType, p.pitches, p.usage, p.velocity, p.spinRate, p.whiffRate])).toEqual([
      ["FF", 3, 0.6, 96, 2300, 0.5],
      ["SL", 2, 0.4, 85.5, 2450, 1],
    ]);
  });

  it("averages movement per pitch type for the pitcher and the league", async () => {
    const arsenal = await pitcherArsenal(PITCHER, 2026);
    const league = await leagueArsenal(2026);

    expect(arsenal.map((p) => [p.pitchType, p.ivb, p.hb])).toEqual([
      ["FF", 16, 8],
      ["SL", 5.5, -4],
    ]);
    expect(league).toEqual(
      expect.arrayContaining([
        { pitchHand: "R", pitchType: "FF", ivb: 16, hb: 8, velocity: 96 },
        { pitchHand: "R", pitchType: "SL", ivb: 5.5, hb: -4, velocity: 85.5 },
      ]),
    );
  });
});

describe("playerSummary", () => {
  it("returns the bio, latest role and seasons for each role", async () => {
    const hitter = await playerSummary(HITTER);
    const pitcher = await playerSummary(PITCHER);

    expect(hitter).toMatchObject({
      fullName: "Hal Hitter",
      batSide: "L",
      latest: { teamId: RED_SOX, jerseyNumber: "12", position: "LF" },
      battingSeasons: [2025, 2026],
      pitchingSeasons: [],
    });
    expect(pitcher).toMatchObject({
      latest: { teamName: "New York Yankees", position: "P" },
      battingSeasons: [],
      pitchingSeasons: [2025, 2026],
    });
  });

  it("returns nothing for an unknown player", async () => {
    expect(await playerSummary(UNKNOWN)).toBeNull();
    expect(await hitterSeason(UNKNOWN, 2026)).toMatchObject({ plateAppearances: 0, avg: null });
    expect(await pitcherGameLog(UNKNOWN, 2026)).toEqual([]);
    expect(await hitterYears(UNKNOWN)).toEqual([]);
  });
});

describe("playerCacheTags", () => {
  it("tags every player who appeared in the games", async () => {
    expect((await playerCacheTags([AT_HOME])).sort()).toEqual([`player-stats:${HITTER}`, `player-stats:${PITCHER}`]);
    expect(await playerCacheTags([])).toEqual([]);
  });
});
