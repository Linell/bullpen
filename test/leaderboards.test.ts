import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

process.env.DUCKDB_URL = ":memory:";

const { withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { fastestPitches, hardestHitBalls, longestHomeRuns } = await import("@/lib/stats/leaderboards");

const RED_SOX = 111;
const YANKEES = 147;
const TODAY = 1;
const POSTSEASON = 2;
const YESTERDAY = 3;
const SPRING = 4;
const SLUGGER = 500;
const CONTACT = 501;
const FLAMETHROWER = 600;
const SOFTTOSSER = 601;

type Game = [game: number, date: string, type: string];

const games: Game[] = [
  [TODAY, "2026-09-28", "R"],
  [POSTSEASON, "2026-09-28", "F"],
  [YESTERDAY, "2026-09-27", "R"],
  [SPRING, "2026-09-28", "S"],
];

type Play = [game: number, atBat: number, batter: number, pitcher: number, event: string, distance: number | null];

const plays: Play[] = [
  [TODAY, 0, SLUGGER, SOFTTOSSER, "home_run", 410],
  [TODAY, 1, CONTACT, SOFTTOSSER, "single", 120],
  [POSTSEASON, 0, CONTACT, FLAMETHROWER, "home_run", 452],
  [POSTSEASON, 1, SLUGGER, FLAMETHROWER, "home_run", null],
  [YESTERDAY, 0, SLUGGER, FLAMETHROWER, "home_run", 480],
  [SPRING, 0, SLUGGER, FLAMETHROWER, "home_run", 500],
];

type Pitch = [game: number, atBat: number, index: number, speed: number | null, inPlay: boolean, launch: number | null];

const pitches: Pitch[] = [
  [TODAY, 0, 0, 88.5, false, 115],
  [TODAY, 0, 1, 90.1, true, 104.2],
  [TODAY, 1, 0, 91.4, true, 98.7],
  [POSTSEASON, 0, 0, 101.8, true, 102.3],
  [POSTSEASON, 1, 0, null, false, null],
  [YESTERDAY, 0, 0, 103.5, true, 118],
  [SPRING, 0, 0, 105, true, 120],
];

const TODAY_RANGE = { from: "2026-09-28", to: "2026-09-28" };

function gameRow([game, date, type]: Game) {
  return `(${game}, 2026, '${date}', '${type}', 1, 'Final', 'F', 'Final', ${RED_SOX}, ${YANKEES}, '${date}T23:05:00Z', now())`;
}

function playRow([game, atBat, batter, pitcher, event, distance]: Play) {
  return `(${game}, 2026, ${atBat}, 1, 'bottom', ${batter}, ${pitcher}, '${event}', ${distance ?? "NULL"}, 0)`;
}

function pitchRow([game, atBat, index, speed, inPlay, launch]: Pitch) {
  const [, , batter, pitcher] = plays.find(([g, ab]) => g === game && ab === atBat)!;
  return `(${game}, 2026, ${atBat}, ${index}, 1, 'bottom', ${batter}, ${pitcher}, 0, 0, 0, ${speed ?? "NULL"}, ${inPlay},
    ${launch ?? "NULL"}, false)`;
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
      VALUES ${[TODAY, POSTSEASON].map(teamRow).join(",")}`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, event_type,
        total_distance, pitch_count)
      VALUES ${plays.map(playRow).join(",")}`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id, pitcher_id,
        balls_before, strikes_before, outs_before, start_speed, is_in_play, launch_speed, abs_challenged)
      VALUES ${pitches.map(pitchRow).join(",")}`);
    await conn.run(`INSERT INTO game_player_bios (player_id, full_name, game_pk, source_date, source_game_number)
      VALUES (${SLUGGER}, 'Sam Slugger', ${TODAY}, '2026-09-28', 1),
        (${CONTACT}, 'Cal Contact', ${TODAY}, '2026-09-28', 1),
        (${FLAMETHROWER}, 'Fay Flamethrower', ${POSTSEASON}, '2026-09-28', 1),
        (${SOFTTOSSER}, 'Sid Softtosser', ${TODAY}, '2026-09-28', 1)`);
  });
});

describe("leaderboards", () => {
  it("ranks the day's home runs by distance, counting postseason games", async () => {
    const leaders = await longestHomeRuns(TODAY_RANGE);

    expect(leaders).toEqual([
      { player: { id: CONTACT, name: "Cal Contact" }, value: 452, gamePk: POSTSEASON, date: "2026-09-28", matchup: "NYY @ BOS" },
      { player: { id: SLUGGER, name: "Sam Slugger" }, value: 410, gamePk: TODAY, date: "2026-09-28", matchup: "NYY @ BOS" },
    ]);
  });

  it("ranks the day's pitches by velocity and credits the pitcher", async () => {
    const leaders = await fastestPitches(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.value])).toEqual([
      [FLAMETHROWER, 101.8],
      [SOFTTOSSER, 91.4],
      [SOFTTOSSER, 90.1],
    ]);
  });

  it("ranks balls in play by exit velocity and ignores fouls", async () => {
    const leaders = await hardestHitBalls(TODAY_RANGE);

    expect(leaders.map((l) => [l.player.id, l.value])).toEqual([
      [SLUGGER, 104.2],
      [CONTACT, 102.3],
      [CONTACT, 98.7],
    ]);
  });

  it("spans any date range and honors the limit and game types", async () => {
    const leaders = await longestHomeRuns({ from: "2026-09-27", to: "2026-09-28", limit: 2, gameTypes: ["R"] });

    expect(leaders.map((l) => [l.gamePk, l.value, l.matchup])).toEqual([
      [YESTERDAY, 480, "Away @ Home"],
      [TODAY, 410, "NYY @ BOS"],
    ]);
  });

  it("is empty before any games in the range have data", async () => {
    expect(await fastestPitches({ from: "2026-09-29", to: "2026-09-29" })).toEqual([]);
  });
});
