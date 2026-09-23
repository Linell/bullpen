import { InngestTestEngine } from "@inngest/test";
import { describe, expect, it } from "vitest";
import { backfillSeason } from "@/inngest/functions/backfill-season";
import { ingestGameFeed } from "@/inngest/functions/ingest-game-feed";
import { rebuildGameTables } from "@/inngest/functions/rebuild-game-tables";
import { syncSchedule } from "@/inngest/functions/sync-schedule";

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
      ],
    });

    expect(result).toEqual({ ...window, games: 3, changed: 1, completed: 2, updated: 0, probablesChanged: 0 });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(1);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-completed", [
      expect.objectContaining({ data: { gamePk: 101 }, id: "game-completed-101" }),
      expect.objectContaining({ data: { gamePk: 102 }, id: "game-completed-102" }),
    ]);
  });

  it("emits game.updated for each changed live game with the run time in its id", async () => {
    const t = new InngestTestEngine({ function: syncSchedule });
    const { ctx, result } = await t.execute({
      events: [timer],
      steps: [
        fetched(row(201, "Live", "I"), row(202, "Live", "I"), row(203, "Live", "I")),
        upserted([201, 202]),
        recorded(),
        mockSend("emit-game-updated"),
      ],
    });

    expect(result).toEqual({ ...window, games: 3, changed: 2, completed: 0, updated: 2, probablesChanged: 0 });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(1);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-updated", [
      expect.objectContaining({ data: { gamePk: 201 }, id: "game-updated-201-1700000000000" }),
      expect.objectContaining({ data: { gamePk: 202 }, id: "game-updated-202-1700000000000" }),
    ]);
  });

  it("sends nothing when nothing changed", async () => {
    const t = new InngestTestEngine({ function: syncSchedule });
    const { ctx, result } = await t.execute({
      events: [timer],
      steps: [fetched(row(301, "Live", "I"), row(302, "Preview", "S")), upserted([]), recorded()],
    });

    expect(result).toEqual({ ...window, games: 2, changed: 0, completed: 0, updated: 0, probablesChanged: 0 });
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
        mockSend("emit-game-probables-changed"),
      ],
    });

    expect(result).toEqual({ ...window, games: 2, changed: 2, completed: 0, updated: 0, probablesChanged: 1 });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(1);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-probables-changed", [
      expect.objectContaining({ data: { gamePk: 402 }, id: "game-probables-changed-402-1700000000000" }),
    ]);
  });
});

describe("backfill-season", () => {
  it("includes the request time in each event id", async () => {
    const t = new InngestTestEngine({ function: backfillSeason });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/season.backfill.requested", data: { season: 2026 }, ts: 1700000000000 }],
      steps: [
        mockStep("fetch-season-dates", { startDate: "2026-03-26", endDate: "2026-10-31" }),
        mockStep("fetch-schedule", [
          { gamePk: 101, abstractState: "Final", codedState: "F" },
          { gamePk: 102, abstractState: "Preview", codedState: "S" },
        ]),
        mockStep("upsert-games", { changed: 2, changedGamePks: [101, 102] }),
        mockStep("record-probables", [102]),
        mockSend("emit-game-completed"),
        mockSend("emit-game-probables-changed"),
      ],
    });

    expect(result).toEqual({ season: 2026, games: 2, changed: 2, completed: 1, probablesChanged: 1 });
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-completed", [
      expect.objectContaining({ data: { gamePk: 101 }, id: "game-completed-101-1700000000000" }),
    ]);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith("emit-game-probables-changed", [
      expect.objectContaining({ data: { gamePk: 102 }, id: "game-probables-changed-102-1700000000000" }),
    ]);
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
  it("sends at most 5,000 events at a time", async () => {
    const gamePks = Array.from({ length: 5001 }, (_, i) => i + 1);
    const t = new InngestTestEngine({ function: rebuildGameTables });
    const { ctx, result } = await t.execute({
      events: [{ name: "mlb/game-tables.rebuild.requested", data: {}, ts: 1700000000000 }],
      steps: [
        mockStep("list-raw-feeds", gamePks),
        mockSend("emit-game-feed-stored-1"),
        mockSend("emit-game-feed-stored-2"),
      ],
    });

    expect(result).toEqual({ feeds: 5001 });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(2);
    expect(ctx.step.sendEvent).toHaveBeenLastCalledWith("emit-game-feed-stored-2", [
      expect.objectContaining({ data: { gamePk: 5001 }, id: "game-feed-stored-5001-1700000000000" }),
    ]);
  });
});
