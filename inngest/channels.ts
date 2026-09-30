import { realtime, staticSchema } from "inngest";
import type { LiveGame, LivePlays } from "@/lib/live-game";

export const LIVE_TOPICS = ["game", "play", "stats"] as const;

export const scoreboardChannel = realtime.channel({
  name: "scoreboard",
  topics: {
    game: { schema: staticSchema<LiveGame>() },
    play: { schema: staticSchema<LivePlays>() },
    stats: { schema: staticSchema<{ gamePk: number }>() },
  },
});

export const gameChannel = realtime.channel({
  name: ({ gamePk }: { gamePk: number }) => `game:${gamePk}`,
  topics: {
    game: { schema: staticSchema<LiveGame>() },
    play: { schema: staticSchema<LivePlays>() },
    stats: { schema: staticSchema<{ gamePk: number }>() },
  },
});
