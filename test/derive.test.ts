import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeAll, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { deriveGame, rawFeedGamePks, storeFeed } from "@/lib/feeds";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Feed = any;

const DIR = path.join(import.meta.dirname, "fixtures/feeds");
const feeds: Feed[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json.gz"))
  .map((f) => JSON.parse(gunzipSync(readFileSync(path.join(DIR, f))).toString("utf8")));

const POSTPONED = 824785;
const played = feeds.filter((f) => f.gamePk !== POSTPONED);

function completePlays(feed: Feed): Feed[] {
  return feed.liveData.plays.allPlays.filter((p: Feed) => p.about.isComplete);
}

function expected(feed: Feed) {
  const plays = completePlays(feed);
  return {
    plays: plays.length,
    pitches: plays.flatMap((p: Feed) => p.playEvents).filter((e: Feed) => e.isPitch).length,
  };
}

function withTimeStamp(feed: Feed, timeStamp: string): Feed {
  return { ...feed, metaData: { ...feed.metaData, timeStamp } };
}

async function gamePageCounts(conn: DuckDBConnection) {
  return rows(
    conn,
    `SELECT
       (SELECT count(*) FROM linescores) AS linescores,
       (SELECT count(*) FROM game_decisions) AS game_decisions,
       (SELECT count(*) FROM play_events) AS play_events`,
  );
}

async function rows(conn: DuckDBConnection, sql: string, values: Record<string, number> = {}) {
  return (await conn.runAndReadAll(sql, values)).getRowObjectsJson() as Record<string, any>[];
}

describe("derive.sql", () => {
  let conn: DuckDBConnection;
  const firstRun = new Map<number, { plays: number; pitches: number }>();
  let firstGamePageCounts: Record<string, any>[];

  beforeAll(async () => {
    conn = await openDb(":memory:");
    for (const feed of feeds) {
      const { status } = await storeFeed(conn, feed);
      if (status !== "stored") throw new Error(`${feed.gamePk} was not stored`);
      firstRun.set(feed.gamePk, await deriveGame(conn, feed.gamePk));
    }
    firstGamePageCounts = await gamePageCounts(conn);
  });

  it("has the fixtures it needs", () => {
    expect(feeds.map((f) => f.gamePk).sort((a, b) => a - b)).toEqual([823394, 824460, 824785, 824787, 824912]);
    const byPk = new Map(feeds.map((f) => [f.gamePk, f]));
    expect(byPk.get(824460).gameData.game.doubleHeader).toBe("Y");
    expect(byPk.get(824912).gameData.datetime.resumedFromDate).toBeDefined();
    expect(byPk.get(823394).liveData.linescore.currentInning).toBeGreaterThan(9);
  });

  it.each(played.map((f) => [f.gamePk, f]))("derives game %i", async (gamePk, feed) => {
    expect(firstRun.get(gamePk)).toEqual(expected(feed));

    const [last] = await rows(
      conn,
      `SELECT home_score_after AS home_score, away_score_after AS away_score FROM plays
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
    expect(firstRun.get(POSTPONED)).toEqual({ plays: 0, pitches: 0 });
  });

  it.each(played.map((f) => [f.gamePk, f]))("totals the linescore of game %i", async (gamePk, feed) => {
    const totals = await rows(
      conn,
      `SELECT half, sum(runs) AS runs, sum(hits) AS hits, sum(errors) AS errors
       FROM linescores WHERE game_pk = $gamePk GROUP BY half`,
      { gamePk },
    );
    const { home, away } = feed.liveData.linescore.teams;
    const side = (half: string) => {
      const { runs, hits, errors } = totals.find((t) => t.half === half)!;
      return { runs: Number(runs), hits: Number(hits), errors: Number(errors) };
    };
    expect(side("bottom")).toEqual({ runs: home.runs, hits: home.hits, errors: home.errors });
    expect(side("top")).toEqual({ runs: away.runs, hits: away.hits, errors: away.errors });
  });

  it("leaves runs empty for an unplayed bottom half", async () => {
    const [bottomNinth] = await rows(
      conn,
      "SELECT runs, hits FROM linescores WHERE game_pk = $gamePk AND inning = 9 AND half = 'bottom'",
      { gamePk: 824460 },
    );
    expect(bottomNinth).toEqual({ runs: null, hits: 0 });
  });

  it("derives extra innings and their placed runners", async () => {
    const [innings] = await rows(conn, "SELECT max(inning) AS last FROM linescores WHERE game_pk = $gamePk", {
      gamePk: 823394,
    });
    const [runners] = await rows(
      conn,
      "SELECT count(*) AS n FROM play_events WHERE game_pk = $gamePk AND event_type = 'runner_placed'",
      { gamePk: 823394 },
    );
    expect(innings.last).toBeGreaterThan(9);
    expect(Number(runners.n)).toBeGreaterThan(0);
  });

  it("records the winning, losing and saving pitchers", async () => {
    const decisions = await rows(
      conn,
      "SELECT game_pk, winner_id, loser_id, save_id FROM game_decisions ORDER BY game_pk",
    );
    expect(decisions).toEqual(
      played
        .map((f) => ({
          game_pk: f.gamePk,
          winner_id: f.liveData.decisions.winner.id,
          loser_id: f.liveData.decisions.loser.id,
          save_id: f.liveData.decisions.save?.id ?? null,
        }))
        .sort((a, b) => a.game_pk - b.game_pk),
    );
  });

  it.each(played.map((f) => [f.gamePk, f]))("keeps every non-pitch event of game %i", async (gamePk, feed) => {
    const events = await rows(
      conn,
      `SELECT at_bat_index, event_index, kind, event_type, call_code, description, player_id
       FROM play_events WHERE game_pk = $gamePk ORDER BY at_bat_index, event_index`,
      { gamePk },
    );
    expect(events).toEqual(
      completePlays(feed).flatMap((p: Feed) =>
        p.playEvents
          .filter((e: Feed) => !e.isPitch)
          .map((e: Feed) => ({
            at_bat_index: p.about.atBatIndex,
            event_index: e.index,
            kind: e.type,
            event_type: e.details.eventType ?? null,
            call_code: e.details.call?.code ?? null,
            description: e.details.description,
            player_id: e.player?.id ?? null,
          })),
      ),
    );
  });

  it("keeps the count-changing events that are not pitches", async () => {
    const kinds = await rows(
      conn,
      `SELECT kind, event_type, call_code, count(*) AS n FROM play_events
       WHERE game_pk = $gamePk GROUP BY ALL ORDER BY ALL`,
      { gamePk: 823394 },
    );
    expect(kinds.map(({ n, ...kind }) => ({ ...kind, n: Number(n) }))).toEqual([
      { kind: "action", event_type: "batter_timeout", call_code: null, n: 26 },
      { kind: "action", event_type: "defensive_indiff", call_code: null, n: 1 },
      { kind: "action", event_type: "defensive_substitution", call_code: null, n: 1 },
      { kind: "action", event_type: "defensive_switch", call_code: null, n: 7 },
      { kind: "action", event_type: "ejection", call_code: null, n: 1 },
      { kind: "action", event_type: "game_advisory", call_code: null, n: 9 },
      { kind: "action", event_type: "mound_visit", call_code: null, n: 12 },
      { kind: "action", event_type: "offensive_substitution", call_code: null, n: 7 },
      { kind: "action", event_type: "pitching_substitution", call_code: null, n: 14 },
      { kind: "action", event_type: "runner_placed", call_code: null, n: 8 },
      { kind: "action", event_type: "stolen_base_2b", call_code: null, n: 2 },
      { kind: "no_pitch", event_type: null, call_code: "VB", n: 13 },
      { kind: "pickoff", event_type: null, call_code: null, n: 9 },
      { kind: "stepoff", event_type: null, call_code: null, n: 3 },
    ]);
  });

  it("numbers events and pitches of an at-bat apart", async () => {
    const [collisions] = await rows(
      conn,
      `SELECT count(*) AS n FROM play_events
       JOIN pitches ON pitches.game_pk = play_events.game_pk
         AND pitches.at_bat_index = play_events.at_bat_index
         AND pitches.pitch_index = play_events.event_index`,
    );
    expect(Number(collisions.n)).toBe(0);
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

  it("takes teams and players only from games that were played", async () => {
    const [fromPostponed] = await rows(
      conn,
      `SELECT (SELECT count(*) FROM teams WHERE source_game_pk = $gamePk)
            + (SELECT count(*) FROM players WHERE source_game_pk = $gamePk) AS n`,
      { gamePk: POSTPONED },
    );
    expect(Number(fromPostponed.n)).toBe(0);
  });

  it("keeps the newest row per team and player", async () => {
    const teams = await rows(conn, "SELECT * FROM teams ORDER BY team_id");
    const newest = new Map<number, string>();
    for (const f of played) {
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
      expect((await storeFeed(conn, feed)).status).toBe("unchanged");
      expect(await deriveGame(conn, feed.gamePk)).toEqual(firstRun.get(feed.gamePk));
    }
    const changed = withTimeStamp(feeds[0], "99999999_000000");
    expect((await storeFeed(conn, changed)).status).toBe("stored");
    expect(await deriveGame(conn, changed.gamePk)).toEqual(firstRun.get(changed.gamePk));
    expect(await gamePageCounts(conn)).toEqual(firstGamePageCounts);
  });

  it("keeps the previous derived rows when deriving fails", async () => {
    const [feed] = played;
    const underivable = withTimeStamp(structuredClone(feed), "99999999_000001");
    underivable.liveData.plays.allPlays[0].about.halfInning = "sideways";

    await storeFeed(conn, underivable);
    await expect(deriveGame(conn, feed.gamePk)).rejects.toThrow(/sideways/);
    const [plays] = await rows(conn, "SELECT count(*) AS n FROM plays WHERE game_pk = $gamePk", {
      gamePk: feed.gamePk,
    });
    expect(Number(plays.n)).toBe(firstRun.get(feed.gamePk)!.plays);

    await storeFeed(conn, withTimeStamp(feed, "99999999_000002"));
    expect(await deriveGame(conn, feed.gamePk)).toEqual(firstRun.get(feed.gamePk));
  });

  it("lists every stored feed", async () => {
    expect(await rawFeedGamePks(conn)).toEqual(feeds.map((f) => f.gamePk).sort((a, b) => a - b));
  });
});
