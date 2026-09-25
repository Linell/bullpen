import { beforeAll, describe, expect, it } from "vitest";

process.env.DUCKDB_URL = ":memory:";

const { readRows, withConnection } = await import("@/lib/db");
const { migrate } = await import("@/lib/migrate");
const { gameCacheTags, teamStatsTag } = await import("@/lib/cache-tags");

const HOME = 110;
const AWAY = 141;
const FINAL = 1;
const SCHEDULED = 2;

beforeAll(async () => {
  await withConnection(async (conn) => {
    await migrate(conn);
    await conn.run(`INSERT INTO games (game_pk, season, official_date, game_type, game_number,
        abstract_state, coded_state, detailed_state, home_team_id, away_team_id, start_utc, updated_at)
      VALUES (${FINAL}, 2026, '2026-09-20', 'R', 1, 'Final', 'F', 'Final', ${HOME}, ${AWAY}, '2026-09-20T23:05:00Z', now()),
        (${SCHEDULED}, 2026, '2026-09-26', 'R', 1, 'Preview', 'S', 'Scheduled', ${HOME}, ${AWAY}, '2026-09-26T23:05:00Z', now())`);
    await conn.run(`INSERT INTO plays (game_pk, season, at_bat_index, inning, half, batter_id, pitcher_id, pitch_count)
      VALUES (${FINAL}, 2026, 0, 1, 'top', 10, 20, 1), (${FINAL}, 2026, 1, 1, 'bottom', 30, 40, 1)`);
    await conn.run(`INSERT INTO pitches (game_pk, season, at_bat_index, pitch_index, inning, half, batter_id,
        pitcher_id, balls_before, strikes_before, outs_before, abs_challenged)
      VALUES (${FINAL}, 2026, 0, 0, 1, 'top', 10, 20, 0, 0, 0, false),
        (${FINAL}, 2026, 1, 0, 1, 'bottom', 30, 40, 0, 0, 0, false)`);
  });
});

describe.each(["team_plays", "team_pitches"])("%s", (view) => {
  it("assigns the away team to bat in the top half and the home team in the bottom", async () => {
    const rows = await readRows(
      `SELECT half::VARCHAR AS half, batting_team_id, fielding_team_id, strftime(official_date, '%Y-%m-%d') AS official_date,
              game_type, coded_state
       FROM ${view} ORDER BY at_bat_index`,
      {},
    );
    expect(rows).toEqual([
      { half: "top", batting_team_id: AWAY, fielding_team_id: HOME, official_date: "2026-09-20", game_type: "R", coded_state: "F" },
      { half: "bottom", batting_team_id: HOME, fielding_team_id: AWAY, official_date: "2026-09-20", game_type: "R", coded_state: "F" },
    ]);
  });
});

describe("gameCacheTags", () => {
  it("tags team stats for a completed game", async () => {
    expect(await gameCacheTags([FINAL])).toEqual(expect.arrayContaining([teamStatsTag(HOME), teamStatsTag(AWAY)]));
  });

  it("leaves team stats alone for an unfinished game", async () => {
    const tags = await gameCacheTags([SCHEDULED]);
    expect(tags).toContain(`team:${HOME}`);
    expect(tags.filter((tag) => tag.startsWith("team-stats:"))).toEqual([]);
  });
});
