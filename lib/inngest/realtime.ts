import { channel } from "inngest/realtime";
import { z } from "zod";

export const scoreUpdate = z.object({
  gamePk: z.number(),
  officialDate: z.string(),
  abstractState: z.string(),
  codedState: z.string(),
  detailedState: z.string(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  inning: z.number().nullable(),
  inningHalf: z.string().nullable(),
});

export type ScoreUpdate = z.infer<typeof scoreUpdate>;

export const scoreboardChannel = channel({
  name: "scoreboard",
  topics: { games: { schema: z.array(scoreUpdate) } },
});
