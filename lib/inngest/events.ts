import { eventType } from "inngest";
import { z } from "zod";

export const seasonBackfillRequested = eventType("mlb/season.backfill.requested", {
  schema: z.object({
    season: z.number().int().min(1876),
    gameTypes: z.array(z.string().length(1)).nonempty().optional(),
  }),
});

export const gameFinal = eventType("mlb/game.final", {
  schema: z.object({
    gamePk: z.number().int().positive(),
    season: z.number().int(),
  }),
});
