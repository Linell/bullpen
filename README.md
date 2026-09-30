# Bullpen

An [Inngest](https://www.inngest.com) example: an event-driven ETL pipeline that loads MLB game data into DuckDB, with a Next.js scoreboard on top.

## How it works

```
cron: every minute, in baseball hours
 │
 ├─▶ sync-schedule                                  upsert `games`, record probables
 │     ├─ mlb/game-schedule.changed ───┬─▶ invalidate-game-cache    revalidate tags ("max")
 │     ├─ mlb/game-probables.changed ──┤
 │     └─ mlb/game.completed ──────────┴─┬─▶ ingest-game-feed       store the raw feed, publish game + play
 │                                       │     │ mlb/game-feed.stored
 └─▶ watch-live-games                    │     ▼
       └─ mlb/game-feed.updated ─────────┘   derive-game-tables     derive one game, expire its tags, publish stats
                                               │ mlb/season-tables.rebuild.requested
                                               ▼
                                             rebuild-season-tables  rebuild one season's tables

you ─ mlb/season.backfill.requested ────▶ backfill-season ─────┐  step.invoke, 25 games per run
you ─ mlb/game-tables.rebuild.requested ▶ rebuild-game-tables ─┤  (mlb/games.backfill.requested)
                                                               ▼
                                                        backfill-games  store + derive a batch
                                                               │ mlb/season-tables.rebuild.requested
                                                               ▼
                                                        rebuild-season-tables
```

Realtime publishes go to the `scoreboard` and `game:{gamePk}` channels: `game` and `play` from `ingest-game-feed` as a live feed changes, and `stats` from `derive-game-tables` once derived tables and caches are fresh, which makes open pages refresh.

- **Events carry ids, not data.** A game feed is ~670 KB, so events say *which* game changed and each function fetches or reads what it needs.
- **Raw first.** `raw_game_feeds` stores the untouched JSON. Everything else is derived from it in SQL, so it can be rebuilt without refetching.
- **Every step is idempotent.** Unchanged feeds aren't re-stored, and re-deriving a game replaces its rows. The event id `game-feed-stored-{gamePk}-{feedTs}` makes Inngest drop repeats of the same feed version for 24 hours.
- **Games derive independently.** A derive only replaces its own game's rows, so up to three run at once, one per game. Backfills and rebuilds skip ingest and derive: `backfill-games` stores and derives 25 games per run, and caches are revalidated once when the whole backfill ends.
- **Adding a consumer doesn't touch the producer.** Anything else that should happen when a feed lands is another function triggered by `mlb/game-feed.stored`.

## Data flow

1. **`raw_game_feeds`**: one untouched feed per game.
2. **`sql/derive.sql`**: per-game tables (`plays`, `pitches`, `play_events`, `linescores`, `game_players`, `game_teams`, `game_player_bios`, `player_game_batting`, …). Each derive deletes and re-inserts one game's rows.
3. **`lib/season-tables.ts`**: per-season tables built from those: `players`, `teams`, `game_starters`, and rollups like `player_season_counts`, `team_season_*` and the daily `event_leaders`. Each derive refreshes its game day's rollups; the whole season rebuilds (debounced) after.
4. **`lib/stats/`, `lib/standings.ts`, …**: cached readers the pages call.

`sql/schema.sql` is a snapshot of the fully migrated schema, the quickest way to see every table. `pnpm test -u` updates it after a migration.

## Caching

Readers use `"use cache: remote"` and tag their results:

| Tag | Purged by |
| --- | --- |
| `game:{gamePk}`, `day:{date}`, `team:{teamId}` | `invalidate-game-cache`, `derive-game-tables` |
| `team-stats:{teamId}`, `standings:{season}` | the same, once the game is completed |
| `player-stats:{playerId}` | `derive-game-tables`, for everyone who played |
| `season-tables:{season}` | `rebuild-season-tables` |
| `games`, `stats` (`ALL_DATA_TAGS`) | `backfill-season`, `rebuild-game-tables` |

Most purges use `revalidateTag(tag, "max")`: the next visitor gets the stale page while it refreshes in the background. `derive-game-tables` uses `{ expire: 0 }` instead, because it tells open pages to refresh right after, and they must not get the stale copy. Tags aside, scores, game pages, standings and team records use the custom `"live"` cache life from `next.config.ts` (revalidate every 60s) until they're final, current-season stats use `"hours"`, and completed games and past seasons use `"max"`.

## Layout

| Path | What's there |
| --- | --- |
| `inngest/events.ts`, `inngest/channels.ts` | Typed events (Zod schemas, validated on send and trigger) and realtime channels |
| `inngest/functions/` | One file per function |
| `app/api/inngest/route.ts` | The endpoint Inngest calls to run functions |
| `app/`, `components/` | Pages and UI |
| `lib/` | MLB API client, DuckDB access, loading, and cached readers |
| `sql/`, `scripts/migrate.ts` | Migrations, `derive.sql`, the schema snapshot, and the migrate script |
| `test/` | Vitest tests, including function tests with `@inngest/test` |
| `docs/` | The original design spec and proposals |

## Running it

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
```

Then run these in two terminals:

```bash
pnpm dev        # Next.js on :3000
pnpm inngest    # Inngest dev server on :8288
```

`DUCKDB_URL` can be a local file path or a MotherDuck database like `md:bullpen_dev`. For MotherDuck, also set `MOTHERDUCK_TOKEN`.

`pnpm db:migrate` applies any new `sql/NNN_*.sql` migrations to `DUCKDB_URL`. The app never migrates on its own, so run it after adding a migration and before deploying code that needs it, with `DUCKDB_URL` and `MOTHERDUCK_TOKEN` set to the production database.

Open http://localhost:8288 to watch runs. `sync-schedule` re-sends `mlb/game.completed` for every completed game each minute, so the **Events** tab fills with duplicates that Inngest drops by id. That's expected. To load a season, send this event from the dev server's **Send event** button:

```json
{ "name": "mlb/season.backfill.requested", "data": { "season": 2026 } }
```

To load only a slice, add `startDate` and/or `endDate` (YYYY-MM-DD, same year); the range is clamped to the season's dates:

```json
{ "name": "mlb/season.backfill.requested", "data": { "season": 2026, "startDate": "2026-06-01", "endDate": "2026-06-07" } }
```

After changing `sql/derive.sql`, rebuild the derived tables from the stored feeds:

```json
{ "name": "mlb/game-tables.rebuild.requested", "data": {} }
```

After changing `lib/season-tables.ts`, rebuild one season's tables:

```json
{ "name": "mlb/season-tables.rebuild.requested", "data": { "season": 2026 } }
```

If a derive exhausts its retries, fix the cause, then replay that run from the Inngest dashboard or send `mlb/game-tables.rebuild.requested`, which gets new event ids on every request.

## Tests

```bash
pnpm test
```

## Data

MLB data comes from the unofficial [MLB Stats API](https://statsapi.mlb.com), which is licensed for individual, non-commercial use only.
