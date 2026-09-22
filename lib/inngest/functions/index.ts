import { backfillSeason } from "./backfill-season";
import { ingestGame } from "./ingest-game";
import { scoreboard } from "./scoreboard";

export const functions = [scoreboard, backfillSeason, ingestGame];
