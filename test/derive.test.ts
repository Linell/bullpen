import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeAll, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { deriveGame, upsertRawFeed } from "@/lib/feeds";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Feed = any;

const DIR = path.join(import.meta.dirname, "fixtures/feeds");
const feeds: Feed[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json.gz"))
  .map((f) => JSON.parse(gunzipSync(readFileSync(path.join(DIR, f))).toString("utf8")));

// 824785 was postponed; its feed now describes the rescheduled, unplayed game.
const POSTPONED = 824785;
const played = feeds.filter((f) => f.gamePk !== POSTPONED);

function completePlays(feed: Feed): Feed[] {
  return feed.liveData.plays.allPlays.filter((p: Feed) => p.about.isComplete);
}

function expected(feed: Feed) {
  const plays = completePlays(feed);
  return {
    plateAppearances: plays.length,
    pitches: plays.flatMap((p: Feed) => p.playEvents).filter((e: Feed) => e.isPitch).length,
  };
}

async function rows(conn: DuckDBConnection, sql: string, values: Record<string, number> = {}) {
  return (await conn.runAndReadAll(sql, values)).getRowObjectsJson() as Record<string, any>[];
}

describe("derive.sql", () => {
  let conn: DuckDBConnection;
  const firstRun = new Map<number, { plateAppearances: number; pitches: number }>();

  beforeAll(async () => {
    conn = await openDb(":memory:");
    for (const feed of feeds) {
      const stored = await upsertRawFeed(conn, feed);
      expect(stored.status).toBe("stored");
      firstRun.set(feed.gamePk, await deriveGame(conn, feed.gamePk));
    }
  });

  it("has the fixtures it needs", () => {
    expect(feeds.map((f) => f.gamePk).sort()).toEqual([823394, 824460, 824785, 824787, 824912]);
    const byPk = new Map(feeds.map((f) => [f.gamePk, f]));
    expect(byPk.get(824460).gameData.game.doubleHeader).toBe("Y");
    expect(byPk.get(824912).gameData.datetime.resumedFromDate).toBeDefined();
    expect(byPk.get(823394).liveData.linescore.currentInning).toBeGreaterThan(9);
  });

  it.each(played.map((f) => [f.gamePk, f]))("derives game %i", async (gamePk, feed) => {
    expect(firstRun.get(gamePk)).toEqual(expected(feed));

    const [last] = await rows(
      conn,
      `SELECT home_score, away_score FROM plate_appearances
       WHERE game_pk = $gamePk ORDER BY at_bat_index DESC LIMIT 1`,
      { gamePk },
    );
    const { home, away } = feed.liveData.linescore.teams;
    const box = feed.liveData.boxscore.teams;
    expect(last).toEqual({ home_score: home.runs, away_score: away.runs });
    expect(last).toEqual({
      home_score: box.home.teamStats.batting.runs,
      away_score: box.away.teamStats.batting.runs,
    });
  });

  it.each(played.map((f) => [f.gamePk, f]))("records ABS challenges for game %i", async (gamePk, feed) => {
    const challenges = await rows(
      conn,
      `SELECT abs_challenge_team_id AS team_id, count(*) AS used,
              count(*) FILTER (WHERE abs_overturned) AS successful
       FROM pitches WHERE game_pk = $gamePk AND abs_challenged GROUP BY ALL`,
      { gamePk },
    );
    for (const side of ["home", "away"] as const) {
      const abs = feed.gameData.absChallenges[side];
      const row = challenges.find((c) => c.team_id === feed.gameData.teams[side].id);
      expect(Number(row?.used ?? 0)).toBe(abs.usedSuccessful + abs.usedFailed);
      expect(Number(row?.successful ?? 0)).toBe(abs.usedSuccessful);
    }
  });

  it("derives no rows for a postponed game", () => {
    expect(firstRun.get(POSTPONED)).toEqual({ plateAppearances: 0, pitches: 0 });
  });

  it("keeps pitch counts before each pitch", async () => {
    const [bad] = await rows(
      conn,
      `SELECT count(*) AS n FROM pitches
       WHERE balls_before NOT BETWEEN 0 AND 3 OR strikes_before NOT BETWEEN 0 AND 2
          OR outs_before NOT BETWEEN 0 AND 2`,
    );
    expect(Number(bad.n)).toBe(0);
  });

  it("keeps the newest row per team and player", async () => {
    const teams = await rows(conn, "SELECT * FROM teams ORDER BY team_id");
    const newest = new Map<number, string>();
    for (const f of feeds) {
      for (const t of [f.gameData.teams.home, f.gameData.teams.away]) {
        const date = f.gameData.datetime.officialDate;
        if ((newest.get(t.id) ?? "") < date) newest.set(t.id, date);
      }
    }
    expect(teams.map((t) => [t.team_id, t.source_date])).toEqual(
      [...newest].sort(([a], [b]) => a - b),
    );
    const orioles = teams.find((t) => t.team_id === 110);
    expect(orioles).toMatchObject({
      name: "Baltimore Orioles",
      team_name: "Orioles",
      abbreviation: "BAL",
      location_name: "Baltimore",
      league_id: 103,
      division_id: 201,
      season: 2026,
    });

    const [players] = await rows(conn, "SELECT count(*) AS n, count(DISTINCT player_id) AS ids FROM players");
    const ids = new Set(feeds.flatMap((f) => Object.values(f.gameData.players).map((p: Feed) => p.id)));
    expect(Number(players.n)).toBe(ids.size);
    expect(Number(players.ids)).toBe(ids.size);
  });

  it("is idempotent", async () => {
    for (const feed of feeds) {
      expect((await upsertRawFeed(conn, feed)).status).toBe("unchanged");
      expect(await deriveGame(conn, feed.gamePk)).toEqual(firstRun.get(feed.gamePk));
    }
    const changed = { ...feeds[0], metaData: { ...feeds[0].metaData, timeStamp: "99999999_000000" } };
    expect((await upsertRawFeed(conn, changed)).status).toBe("stored");
    expect(await deriveGame(conn, changed.gamePk)).toEqual(firstRun.get(changed.gamePk));
  });

  it("rebuilds everything when gamePk is null", async () => {
    const before = await rows(
      conn,
      "SELECT game_pk, count(*) AS n FROM pitches GROUP BY ALL ORDER BY game_pk",
    );
    const total = [...firstRun.values()].reduce(
      (sum, c) => ({
        plateAppearances: sum.plateAppearances + c.plateAppearances,
        pitches: sum.pitches + c.pitches,
      }),
      { plateAppearances: 0, pitches: 0 },
    );
    expect(await deriveGame(conn, null)).toEqual(total);
    expect(
      await rows(conn, "SELECT game_pk, count(*) AS n FROM pitches GROUP BY ALL ORDER BY game_pk"),
    ).toEqual(before);
  });
});
