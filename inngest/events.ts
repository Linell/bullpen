import { eventType } from "inngest";
import { z } from "zod";

const gamePk = z.number().int().positive();

export const seasonBackfillRequested = eventType("mlb/season.backfill.requested", {
  schema: z.object({ season: z.number().int().min(1876) }),
});

export const gameCompleted = eventType("mlb/game.completed", {
  schema: z.object({ gamePk }),
});

export const gameUpdated = eventType("mlb/game.updated", {
  schema: z.object({ gamePk }),
});

export const gameFeedStored = eventType("mlb/game-feed.stored", {
  schema: z.object({ gamePk }),
});

export const gameTablesRebuildRequested = eventType("mlb/game-tables.rebuild.requested", {
  schema: z.object({}),
});

export const gameProbablesChanged = eventType("mlb/game-probables.changed", {
  schema: z.object({ gamePk }),
});

export const gameTablesDerived = eventType("mlb/game-tables.derived", {
  schema: z.object({ gamePk }),
});
