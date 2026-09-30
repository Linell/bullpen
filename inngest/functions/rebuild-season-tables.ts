import { revalidateTag } from "next/cache";
import { seasonTablesTag } from "@/lib/cache-tags";
import { withConnection } from "@/lib/db";
import { rebuildSeasonTables as rebuildTables } from "@/lib/season-tables";
import { inngest } from "../client";
import { seasonTablesRebuildRequested } from "../events";

export const rebuildSeasonTables = inngest.createFunction(
  {
    id: "rebuild-season-tables",
    triggers: [seasonTablesRebuildRequested],
    debounce: { key: "event.data.season", period: "2m", timeout: "3m" },
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const { season } = event.data;

    await step.run("rebuild-season-tables", () => withConnection((conn) => rebuildTables(conn, season)));

    await step.run("revalidate-season-tables", () => revalidateTag(seasonTablesTag(season), "max"));

    return { season };
  },
);
