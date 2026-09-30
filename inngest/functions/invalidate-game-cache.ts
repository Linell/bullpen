import { revalidateTag } from "next/cache";
import { gameCacheTags } from "@/lib/game-cache-tags";
import { inngest } from "../client";
import { gameCompleted, gameProbablesChanged, gameScheduleChanged } from "../events";

export const invalidateGameCache = inngest.createFunction(
  {
    id: "invalidate-game-cache",
    triggers: [gameScheduleChanged, gameCompleted, gameProbablesChanged],
    batchEvents: { maxSize: 5, timeout: "5s" },
  },
  async ({ events, step }) => {
    const gamePks = [...new Set(events.map((event) => event.data.gamePk))];

    const tags = await step.run("load-game-tags", () => gameCacheTags(gamePks));

    await step.run("revalidate-tags", () => {
      for (const tag of tags) revalidateTag(tag, "max");
    });

    return { gamePks: gamePks.length, tags: tags.length };
  },
);
