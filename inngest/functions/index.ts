import { backfillGames } from "./backfill-games";
import { backfillSeason } from "./backfill-season";
import { deriveGameTables } from "./derive-game-tables";
import { ingestGameFeed } from "./ingest-game-feed";
import { invalidateGameCache } from "./invalidate-game-cache";
import { rebuildGameTables } from "./rebuild-game-tables";
import { syncSchedule } from "./sync-schedule";
import { watchLiveGames } from "./watch-live-games";

export const functions = [
  syncSchedule,
  watchLiveGames,
  backfillSeason,
  backfillGames,
  ingestGameFeed,
  deriveGameTables,
  rebuildGameTables,
  invalidateGameCache,
];
