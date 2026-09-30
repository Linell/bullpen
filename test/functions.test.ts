import { InngestTestEngine } from "@inngest/test";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { backfillGames } from "@/inngest/functions/backfill-games";
import { backfillSeason } from "@/inngest/functions/backfill-season";
import { deriveGameTables } from "@/inngest/functions/derive-game-tables";
import { ingestGameFeed } from "@/inngest/functions/ingest-game-feed";
import { invalidateGameCache } from "@/inngest/functions/invalidate-game-cache";
import { rebuildGameTables } from "@/inngest/functions/rebuild-game-tables";
import { rebuildSeasonRollups } from "@/inngest/functions/rebuild-season-rollups";
import { syncSchedule } from "@/inngest/functions/sync-schedule";
import { seasonBackfillRequested } from "@/inngest/events";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

function mockStep(id: string, output: unknown) {
  return { id, handler: () => output };
}

function mockSend(id: string) {
  return mockStep(id, { ids: [] });
}

describe("sync-schedule", () => {
  const window = { startDate: "2026-09-21", endDate: "2026-09-22" };
  const timer = { name: "inngest/scheduled.timer", data: { cron: "* * * * *" }, ts: 1700000000000 };

  function row(gamePk: number, abstractState: string, codedState: string) {
    return { gamePk, abstractState, codedState };
  }

  function fetched(...rows: object[]) {
    return mockStep("fetch-schedule", { ...window, rows });
  }

  function upserted(changedGamePks: number[]) {
    return mockStep("upsert-games", { changed: changedGamePks.length, changedGamePks });
  }

  function recorded(gamePks: number[] = []) {
    return mockStep("record-probables", gamePks);
  }

  it("emits game.completed with one id per game", async () => {
    const t = new InngestTestEngine({ function: syncSchedule });
    const { ctx, result } = await t.execute({
      events: [timer],
      steps: [
        fetched(row(101, "Final", "F"), row(102, "Final", "F"), row(103, "Preview", "S")),
        upserted([101]),
        recorded(),
        mockSend("emit-game-completed"),
        mockSend("emit-game-changed"),
      ],
    });

    expect(result).toEqual({ ...window, games: 3, changed: 1, completed: 2, probablesChanged: 0 });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(2);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-completed", [
      expect.objectContaining({ data: { gamePk: 101 }, id: "game-completed-101" }),
      expect.objectContaining({ data: { gamePk: 102 }, id: "game-completed-102" }),
    ]);
  });

  it("sends nothing when nothing changed", async () => {
    const t = new InngestTestEngine({ function: syncSchedule });
    const { ctx, result } = await t.execute({
      events: [timer],
      steps: [fetched(row(301, "Live", "I"), row(302, "Preview", "S")), upserted([]), recorded()],
    });

    expect(result).toEqual({ ...window, games: 2, changed: 0, completed: 0, probablesChanged: 0 });
    expect(ctx.step.sendEvent).not.toHaveBeenCalled();
  });

  it("emits game-probables.changed for each game whose probables changed", async () => {
    const t = new InngestTestEngine({ function: syncSchedule });
    const { ctx, result } = await t.execute({
      events: [timer],
      steps: [
        fetched(row(401, "Preview", "S"), row(402, "Preview", "S")),
        upserted([401, 402]),
        recorded([402]),
        mockSend("emit-game-changed"),
        mockSend("emit-game-probables-changed"),
      ],
    });

    expect(result).toEqual({ ...window, games: 2, changed: 2, completed: 0, probablesChanged: 1 });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(2);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-changed", [
      expect.objectContaining({ data: { gamePk: 401 }, id: "game-changed-401-1700000000000" }),
      expect.objectContaining({ data: { gamePk: 402 }, id: "game-changed-402-1700000000000" }),
    ]);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-probables-changed", [
      expect.objectContaining({ data: { gamePk: 402 }, id: "game-probables-changed-402-1700000000000" }),
    ]);
  });
});

describe("backfill-season", () => {
  const seasonDates = { startDate: "2026-03-26", endDate: "2026-10-31" };

  function requested(data: object) {
    return { name: "mlb/season.backfill.requested", data: { season: 2026, ...data }, ts: 1700000000000 };
  }

  it("backfills completed games in batches and revalidates once", async () => {
    vi.mocked(revalidateTag).mockClear();
    const completed = Array.from({ length: 30 }, (_, i) => ({ gamePk: i + 1, abstractState: "Final", codedState: "F" }));
    const t = new InngestTestEngine({ function: backfillSeason });
    const { ctx, result } = await t.execute({
      events: [requested({})],
      steps: [
        mockStep("fetch-season-dates", seasonDates),
        mockStep("fetch-schedule", [...completed, { gamePk: 31, abstractState: "Preview", codedState: "S" }]),
        mockStep("upsert-games", { changed: 31, changedGamePks: [] }),
        mockStep("record-probables", [31]),
        mockSend("emit-game-probables-changed"),
        mockStep("backfill-games-1", { failed: [] }),
        mockStep("backfill-games-2", { failed: [27] }),
      ],
    });

    expect(result).toEqual({
      season: 2026, ...seasonDates, games: 31, rescheduled: 0, changed: 31, completed: 30, failed: [27], probablesChanged: 1,
    });
    expect(ctx.step.invoke).toHaveBeenCalledTimes(2);
    expect(ctx.step.invoke).toHaveBeenLastCalledWith(
      "backfill-games-2",
      expect.objectContaining({ data: { gamePks: [26, 27, 28, 29, 30], refetch: true } }),
    );
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-probables-changed", [
      expect.objectContaining({ data: { gamePk: 31 }, id: "game-probables-changed-31-1700000000000" }),
    ]);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("re-fetches postponed games so completed makeups are ingested", async () => {
    const t = new InngestTestEngine({ function: backfillSeason });
    const { ctx, result } = await t.execute({
      events: [requested({ startDate: "2026-07-23", endDate: "2026-08-05" })],
      steps: [
        mockStep("fetch-season-dates", seasonDates),
        mockStep("fetch-schedule", [
          { gamePk: 101, abstractState: "Final", codedState: "D" },
          { gamePk: 102, abstractState: "Final", codedState: "F" },
        ]),
        mockStep("fetch-rescheduled-games", [{ gamePk: 101, abstractState: "Final", codedState: "F" }]),
        mockStep("upsert-games", { changed: 2, changedGamePks: [101, 102] }),
        mockStep("record-probables", []),
        mockStep("backfill-games-1", { failed: [] }),
      ],
    });

    expect(result).toMatchObject({ games: 2, rescheduled: 1, completed: 2 });
    expect(ctx.step.invoke).toHaveBeenCalledWith(
      "backfill-games-1",
      expect.objectContaining({ data: { gamePks: [101, 102], refetch: true } }),
    );
  });

  it("clamps a requested slice to the season's dates", async () => {
    const t = new InngestTestEngine({ function: backfillSeason });
    const { result } = await t.execute({
      events: [requested({ startDate: "2026-03-01", endDate: "2026-04-15" })],
      steps: [
        mockStep("fetch-season-dates", seasonDates),
        mockStep("fetch-schedule", []),
        mockStep("upsert-games", { changed: 0, changedGamePks: [] }),
        mockStep("record-probables", []),
      ],
    });

    expect(result).toMatchObject({ startDate: "2026-03-26", endDate: "2026-04-15", games: 0 });
  });

  it("fails without retrying when the slice is outside the season", async () => {
    const t = new InngestTestEngine({ function: backfillSeason });
    const { error } = await t.execute({
      events: [requested({ startDate: "2026-11-01" })],
      steps: [mockStep("fetch-season-dates", seasonDates)],
    });

    expect(error).toMatchObject({ name: "NonRetriableError" });
  });

  it("rejects a slice that ends before it starts or leaves the season's year", async () => {
    const validate = (data: object) => seasonBackfillRequested.create({ season: 2026, ...data }).validate();

    await expect(validate({ startDate: "2026-06-07", endDate: "2026-06-01" })).rejects.toThrow();
    await expect(validate({ endDate: "2027-01-01" })).rejects.toThrow();
    await expect(validate({ startDate: "2026-06-01", endDate: "2026-06-07" })).resolves.toBeUndefined();
  });
});

describe("ingest-game-feed", () => {
  const stored = { gamePk: 101, feedTs: "20260921_230000", status: "stored" };

  it("emits game-feed.stored when the feed is stored", async () => {
    const t = new InngestTestEngine({ function: ingestGameFeed });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/game.completed", data: { gamePk: 101 } }],
      steps: [mockStep("load-game-feed", stored), mockSend("emit-game-feed-stored")],
    });

    expect(result).toEqual(stored);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      "emit-game-feed-stored",
      expect.objectContaining({ data: { gamePk: 101 }, id: "game-feed-stored-101-20260921_230000" }),
    );
  });

  it("sends nothing when the feed is unchanged", async () => {
    const unchanged = { ...stored, status: "unchanged" };
    const t = new InngestTestEngine({ function: ingestGameFeed });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/game.completed", data: { gamePk: 101 } }],
      steps: [mockStep("load-game-feed", unchanged)],
    });

    expect(result).toEqual(unchanged);
    expect(ctx.step.sendEvent).not.toHaveBeenCalled();
  });

  it("runs on game.updated", async () => {
    const t = new InngestTestEngine({ function: ingestGameFeed });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/game.updated", data: { gamePk: 101 } }],
      steps: [mockStep("load-game-feed", stored), mockSend("emit-game-feed-stored")],
    });

    expect(result).toEqual(stored);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      "emit-game-feed-stored",
      expect.objectContaining({ data: { gamePk: 101 }, id: "game-feed-stored-101-20260921_230000" }),
    );
  });
});

describe("rebuild-game-tables", () => {
  it("re-derives every stored feed in batches without refetching", async () => {
    const gamePks = Array.from({ length: 51 }, (_, i) => i + 1);
    const t = new InngestTestEngine({ function: rebuildGameTables });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/game-tables.rebuild.requested", data: {}, ts: 1700000000000 }],
      steps: [
        mockStep("list-raw-feeds", gamePks),
        mockStep("backfill-games-1", { failed: [] }),
        mockStep("backfill-games-2", { failed: [] }),
        mockStep("backfill-games-3", { failed: [] }),
      ],
    });

    expect(result).toEqual({ feeds: 51 });
    expect(ctx.step.invoke).toHaveBeenCalledTimes(3);
    expect(ctx.step.invoke).toHaveBeenLastCalledWith(
      "backfill-games-3",
      expect.objectContaining({ data: { gamePks: [51], refetch: false } }),
    );
  });
});

describe("derive-game-tables", () => {
  it("announces the derived game and asks to rebuild its season's rollups", async () => {
    const t = new InngestTestEngine({ function: deriveGameTables });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/game-feed.stored", data: { gamePk: 101 }, ts: 1700000000000 }],
      steps: [
        mockStep("derive-game", { plays: 70, pitches: 280, seasons: [2026] }),
        mockSend("emit-game-tables-derived"),
      ],
    });

    expect(result).toEqual({ gamePk: 101, plays: 70, pitches: 280 });
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-tables-derived", [
      expect.objectContaining({ data: { gamePk: 101 }, id: "game-tables-derived-101-1700000000000" }),
      expect.objectContaining({ name: "mlb/season-rollups.rebuild.requested", data: { season: 2026 } }),
    ]);
  });
});

describe("backfill-games", () => {
  it("derives only the feeds it stored and asks to rebuild their seasons' rollups", async () => {
    const t = new InngestTestEngine({ function: backfillGames });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/games.backfill.requested", data: { gamePks: [101, 102, 103], refetch: true } }],
      steps: [
        mockStep("store-feeds", { stored: [101], failed: [103] }),
        mockStep("derive-games", { plays: 70, pitches: 280, seasons: [2025, 2026] }),
        mockSend("emit-season-rollups-rebuild-requested"),
      ],
    });

    expect(result).toEqual({ games: 3, stored: 1, failed: [103], plays: 70, pitches: 280 });
    expect(ctx.step.run).toHaveBeenCalledTimes(2);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-season-rollups-rebuild-requested", [
      expect.objectContaining({ name: "mlb/season-rollups.rebuild.requested", data: { season: 2025 } }),
      expect.objectContaining({ name: "mlb/season-rollups.rebuild.requested", data: { season: 2026 } }),
    ]);
  });

  it("derives stored feeds without refetching them", async () => {
    const t = new InngestTestEngine({ function: backfillGames });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/games.backfill.requested", data: { gamePks: [101, 102], refetch: false } }],
      steps: [
        mockStep("derive-games", { plays: 140, pitches: 560, seasons: [2026] }),
        mockSend("emit-season-rollups-rebuild-requested"),
      ],
    });

    expect(result).toEqual({ games: 2, stored: 2, failed: [], plays: 140, pitches: 560 });
    expect(ctx.step.run).toHaveBeenCalledTimes(1);
  });
});

describe("invalidate-game-cache", () => {
  it("dedupes gamePks, revalidates each game's tags and announces derived games", async () => {
    vi.mocked(revalidateTag).mockClear();
    const gameTags = ["game:101", "day:2026-09-24", "team:110", "team:141"];
    const playerTags = ["player-stats:500"];
    const t = new InngestTestEngine({ function: invalidateGameCache });
    const { ctx, result } = await t.execute({
      events: [
        { name: "mlb/game.changed", data: { gamePk: 101 } },
        { name: "mlb/game.completed", data: { gamePk: 101 } },
        { name: "mlb/game-tables.derived", data: { gamePk: 101 } },
      ],
      steps: [
        mockStep("load-game-tags", gameTags),
        mockStep("load-player-tags", playerTags),
        mockStep("publish-scoreboard-derived", { gamePks: [101] }),
        mockStep("publish-game-derived-101", { gamePk: 101 }),
      ],
    });

    expect(result).toEqual({ gamePks: 1, tags: 5 });
    expect(revalidateTag).toHaveBeenCalledTimes(5);
    for (const tag of [...gameTags, ...playerTags]) expect(revalidateTag).toHaveBeenCalledWith(tag, "max");
    expect(ctx.step.realtime.publish).toHaveBeenCalledWith(
      "publish-scoreboard-derived",
      expect.objectContaining({ channel: "scoreboard", topic: "derived" }),
      { gamePks: [101] },
    );
  });
});

describe("rebuild-season-rollups", () => {
  it("refreshes the season's rollups, then revalidates its tag", async () => {
    vi.mocked(revalidateTag).mockClear();
    const t = new InngestTestEngine({ function: rebuildSeasonRollups });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/season-rollups.rebuild.requested", data: { season: 2026 } }],
      steps: [mockStep("refresh-season-rollups", undefined)],
    });

    expect(result).toEqual({ season: 2026 });
    expect(ctx.step.run).toHaveBeenCalledWith("refresh-season-rollups", expect.any(Function));
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("season-rollups:2026", "max");
  });
});
