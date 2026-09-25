# Bullpen

An [Inngest](https://www.inngest.com) example: an event-driven ETL pipeline that loads MLB game data into DuckDB, with a Next.js scoreboard on top.

## How it works

```
 cron (every minute, in season)  you
        │                         │  mlb/season.backfill.requested
        ▼                         ▼
  sync-schedule            backfill-season         Load the schedule into `games`
        └──────────┬──────────────┘
                   │  mlb/game.completed           one event per finished game
                   ▼
           ingest-game-feed                        Load one raw feed into `raw_game_feeds`
                   │  mlb/game-feed.stored
                   ▼
          derive-game-tables                       Run sql/derive.sql for one game
                   ▲
                   │  mlb/game-feed.stored         one event per stored feed
          rebuild-game-tables                      Re-derive every game without refetching
                   ▲
                   │  mlb/game-tables.rebuild.requested
                  you
```

- **Events carry ids, not data.** A game feed is ~670 KB, so events say *which* game changed and each function fetches or reads what it needs.
- **Raw first.** `raw_game_feeds` stores the untouched JSON. The other tables are derived from it in SQL, so they can be rebuilt without refetching.
- **Every step is idempotent.** Unchanged feeds aren't re-stored, and re-deriving a game replaces its rows. `ingest-game-feed` emits `mlb/game-feed.stored` even when the feed didn't change, so a feed that was stored but never announced still gets derived. The event id `game-feed-stored-{gamePk}-{feedTs}` makes Inngest drop repeats of the same feed version for 24 hours.
- **Games derive independently.** A derive only replaces its own game's rows, so up to three run at once. `players` and `teams` are views that pick the newest per-game bio and team row, so the order games finish in doesn't matter. Backfills and rebuilds tag their events `reason: "backfill"`, use at most two of the three slots, and run after live games, so a live game never waits behind a rebuild.
- **Adding a consumer doesn't touch the producer.** Anything else that should happen when a feed lands is another function triggered by `mlb/game-feed.stored`.

| Path | What's there |
| --- | --- |
| `inngest/events.ts` | Typed event definitions (Zod schemas, validated on send and trigger) |
| `inngest/functions/` | One file per function |
| `app/api/inngest/route.ts` | The endpoint Inngest calls to run functions |
| `app/page.tsx`, `components/` | The scoreboard page, which reads `games` on each request |
| `lib/` | MLB API client, DuckDB access, schedule and feed loading. Plain TypeScript, except that `lib/mlb.ts` throws Inngest's `RetryAfterError` when MLB rate limits us |
| `sql/`, `scripts/migrate.ts` | Schema migrations, `derive.sql`, and the script that applies migrations |
| `test/` | Vitest tests, including function tests with `@inngest/test` |
| `docs/` | The design spec |

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

If a derive exhausts its retries, fix the cause, then replay that run from the Inngest dashboard or send `mlb/game-tables.rebuild.requested`, which gets new event ids on every request.

## Tests

```bash
pnpm test
```

## Data

MLB data comes from the unofficial [MLB Stats API](https://statsapi.mlb.com), which is licensed for individual, non-commercial use only.
