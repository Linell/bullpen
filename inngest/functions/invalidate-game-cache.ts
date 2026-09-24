import { revalidateTag } from "next/cache";
import { gameCacheTags } from "@/lib/cache-tags";
import { inngest } from "../client";
import { gameCompleted, gameProbablesChanged, gameTablesDerived, gameUpdated } from "../events";

export const invalidateGameCache = inngest.createFunction(
  {
    id: "invalidate-game-cache",
    triggers: [gameUpdated, gameCompleted, gameProbablesChanged, gameTablesDerived],
    batchEvents: { maxSize: 100, timeout: "5s" },
  },
  async ({ events, step }) => {
    const gamePks = [...new Set(events.map((event) => event.data.gamePk))];

    const tags = await step.run("load-game-tags", () => gameCacheTags(gamePks));

    await step.run("revalidate-tags", () => {
      for (const tag of tags) revalidateTag(tag, { expire: 0 });
    });

    return { gamePks: gamePks.length, tags: tags.length };
  },
);
