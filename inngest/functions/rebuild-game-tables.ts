import { revalidateTag } from "next/cache";
import { BACKFILL_TAGS } from "@/lib/cache-tags";
import { withConnection } from "@/lib/db";
import { rawFeedGamePks } from "@/lib/feeds";
import { inngest } from "../client";
import { gameTablesRebuildRequested } from "../events";
import { backfillBatches, backfillGames } from "./backfill-games";

export const rebuildGameTables = inngest.createFunction(
  { id: "rebuild-game-tables", triggers: [gameTablesRebuildRequested] },
  async ({ step }) => {
    const gamePks = await step.run("list-raw-feeds", () => withConnection(rawFeedGamePks));

    await Promise.all(
      backfillBatches(gamePks).map((batch, i) =>
        step.invoke(`backfill-games-${i + 1}`, { function: backfillGames, data: { gamePks: batch, refetch: false } }),
      ),
    );

    await step.run("revalidate-tags", () => {
      for (const tag of BACKFILL_TAGS) revalidateTag(tag, { expire: 0 });
    });

    return { feeds: gamePks.length };
  },
);
