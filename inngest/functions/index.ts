import { backfillSeason } from "./backfill-season";
import { deriveGameTables } from "./derive-game-tables";
import { ingestGameFeed } from "./ingest-game-feed";
import { invalidateGameCache } from "./invalidate-game-cache";
import { rebuildGameTables } from "./rebuild-game-tables";
import { syncSchedule } from "./sync-schedule";

export const functions = [
  syncSchedule,
  backfillSeason,
  ingestGameFeed,
  deriveGameTables,
  rebuildGameTables,
  invalidateGameCache,
];
