import { revalidateTag } from "next/cache";
import { seasonRollupsTag } from "@/lib/cache-tags";
import { withConnection } from "@/lib/db";
import { refreshSeasonRollups } from "@/lib/season-rollups";
import { inngest } from "../client";
import { seasonRollupsRebuildRequested } from "../events";

export const rebuildSeasonRollups = inngest.createFunction(
  {
    id: "rebuild-season-rollups",
    triggers: [seasonRollupsRebuildRequested],
    debounce: { key: "event.data.season", period: "2m", timeout: "3m" },
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const { season } = event.data;

    await step.run("refresh-season-rollups", () => withConnection((conn) => refreshSeasonRollups(conn, season)));

    await step.run("revalidate-season-rollups", () => revalidateTag(seasonRollupsTag(season), "max"));

    return { season };
  },
);
