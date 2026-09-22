import { eventType } from "inngest";
import { z } from "zod";

// Regular season plus every postseason round.
export const DEFAULT_GAME_TYPES = ["R", "F", "D", "L", "W"];

// Sent by a person, so validate it.
export const seasonBackfillRequested = eventType("mlb/season.backfill.requested", {
  schema: z.object({
    season: z.number().int().min(1876),
    gameTypes: z.array(z.string().length(1)).nonempty().optional(),
  }),
});

// Ids only: game feeds exceed the event size limit.
export const gameFinal = eventType("mlb/game.final", {
  schema: z.object({
    gamePk: z.number().int().positive(),
    season: z.number().int(),
  }),
});
