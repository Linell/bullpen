import { revalidateTag } from "next/cache";
import { gameCacheTags, playerCacheTags } from "@/lib/cache-tags";
import { gameChannel, scoreboardChannel } from "../channels";
import { inngest } from "../client";
import { gameChanged, gameCompleted, gameProbablesChanged, gameTablesDerived } from "../events";

export const invalidateGameCache = inngest.createFunction(
  {
    id: "invalidate-game-cache",
    triggers: [gameChanged, gameCompleted, gameProbablesChanged, gameTablesDerived],
    batchEvents: { maxSize: 5, timeout: "5s" },
  },
  async ({ events, step }) => {
    const gamePks = [...new Set(events.map((event) => event.data.gamePk))];
    const derivedEvents = events.filter((event) => event.name === gameTablesDerived.name);
    const derivedGamePks = [...new Set(derivedEvents.map((event) => event.data.gamePk))];

    const gameTags = await step.run("load-game-tags", () => gameCacheTags(gamePks));

    const playerTags = await step.run("load-player-tags", () => playerCacheTags(derivedGamePks));

    const tags = [...gameTags, ...playerTags];

    await step.run("revalidate-tags", () => {
      for (const tag of tags) revalidateTag(tag, { expire: 0 });
    });

    if (derivedGamePks.length > 0) {
      await step.realtime.publish("publish-scoreboard-derived", scoreboardChannel.derived, { gamePks: derivedGamePks });
    }

    for (const gamePk of derivedGamePks) {
      await step.realtime.publish(`publish-game-derived-${gamePk}`, gameChannel({ gamePk }).derived, { gamePk });
    }

    return { gamePks: gamePks.length, tags: tags.length };
  },
);
