import { realtime, staticSchema } from "inngest";
import type { LiveGame, LivePlays } from "@/lib/live-game";

export const SCOREBOARD_TOPICS = ["game", "play", "derived"] as const;

export const GAME_TOPICS = ["game", "derived"] as const;

export const scoreboardChannel = realtime.channel({
  name: "scoreboard",
  topics: {
    game: { schema: staticSchema<LiveGame>() },
    play: { schema: staticSchema<LivePlays>() },
    derived: { schema: staticSchema<{ gamePks: number[] }>() },
  },
});

export const gameChannel = realtime.channel({
  name: ({ gamePk }: { gamePk: number }) => `game:${gamePk}`,
  topics: {
    game: { schema: staticSchema<LiveGame>() },
    derived: { schema: staticSchema<{ gamePk: number }>() },
  },
});
