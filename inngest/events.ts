import { eventType } from "inngest";
import { z } from "zod";

const gamePk = z.number().int().positive();

const inYear = (date: string | undefined, year: number) => !date || date.startsWith(`${year}-`);

export const seasonBackfillRequested = eventType("mlb/season.backfill.requested", {
  schema: z
    .object({
      season: z.number().int().min(1876),
      startDate: z.iso.date().optional(),
      endDate: z.iso.date().optional(),
    })
    .refine(({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate, {
      message: "startDate must be on or before endDate",
    })
    .refine(({ season, startDate, endDate }) => inYear(startDate, season) && inYear(endDate, season), {
      message: "startDate and endDate must be in the season's year",
    }),
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
