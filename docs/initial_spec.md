# Bullpen: MLB ingest and scoreboard spec

## Problem

- We can't see which MLB games are live today, or their scores. A scoreboard that refreshes on each page load is enough.
- We have no queryable 2026 season dataset (games, plays, pitches) for analytics.
- The only source is MLB's unofficial Stats API, so we must fetch politely and avoid re-fetching data we already have.

## Solution

Five Inngest functions and five typed events feed a MotherDuck database. Raw game JSON is the source of truth, and analytics tables are derived from it in SQL.

- **`sync-schedule`** runs every minute during baseball months and hours. One schedule request returns every game's status and score. It updates `games`, emits `mlb/game.completed` for each completed game and `mlb/game.updated` for each live game that changed.
- **`backfill-season`** does the same for a whole season when a person asks for it.
- **`ingest-game-feed`** fetches a completed or live game's feed, stores the raw JSON if it is newer, and emits `mlb/game-feed.stored`.
- **`derive-game-tables`** runs `derive.sql` to rebuild that game's rows.
- **`rebuild-game-tables`** emits `mlb/game-feed.stored` for every stored feed, so every game is re-derived without refetching.

Live and backfill share one ingest path. Re-running anything is safe: unchanged feeds aren't re-stored, deriving a game replaces its rows, and deterministic event ids stop Inngest from repeating work.

## Out of scope

- Seasons before 2026. The schema supports them, and loading one later is just another backfill event.
- Pushing live score updates to the UI. The page reads `games` on each request; Inngest Realtime can be added later.
- Analytics UI and models.
- Automatic rechecks for scorer corrections. Re-run the backfill instead.

## Risks

- **Unofficial API.** MLB's API has no SLA and its fields change; ABS challenges were added in 2026, for example. Mitigation: store the raw JSON so tables can be rebuilt without re-fetching.
- **Usage terms.** MLB's copyright notice limits use to individual, non-commercial purposes. The project stays personal.
- **Native binary.** `@duckdb/node-api` may not run on serverless platforms. Verify on the deploy target early.
- **Local single writer.** An offline `.duckdb` file can only be opened by one process, so run a single app server against it.

## Release

1. Build against `md:bullpen_dev` with the local Inngest dev server.
2. Ingest a handful of final games and check the counts against MLB's box scores.
3. Backfill the 2026 season in dev.
4. Point prod at `md:bullpen`, deploy, and run the backfill there.

Rollback: fix `derive.sql` and send `mlb/game-tables.rebuild.requested` to rebuild the derived tables from `raw_game_feeds`. Failed runs can also be replayed from the Inngest dashboard.

## Context

- **Schedule** (`/api/v1/schedule?sportId=1&startDate=…&endDate=…&gameType=R,F,D,L,W&hydrate=linescore,team&fields=…`) returns every game's `gamePk`, status and score over a date range in one call. `fields` trims the response to what `games` needs.
- **Game feed** (`/api/v1.1/game/{gamePk}/feed/live`, about 670 KB) has pitch-level data: velocity, spin, movement and location, plus exit velocity and launch angle on balls in play. It also includes weather, umpires, box score and ABS challenges. `metaData.timeStamp` identifies the feed version.
- A season is about 2,430 games, 185k plate appearances and 700k pitches.
- Gotchas:
  - `gameDate` is UTC. Bucket games by `officialDate`.
  - Doubleheaders have separate `gamePk`s; use `gameNumber` to tell them apart.
  - Postponed games show `abstractGameState: Final` with `codedGameState: D`. A game is completed when `codedGameState` is `F` or `O`, or `Q`/`R` for a forfeit.
  - Forfeited games are ingested like any other. Official Baseball Rule 9.03(e) keeps the stats of a forfeited regulation game, so the tables store the plays as they happened. Analytics can filter on `coded_state IN ('Q', 'R')`. The scoreboard shows the API's score with a "Forfeit" note.
  - Suspended games span dates. Key everything by `gamePk`.
  - A game suspended mid-play (`codedGameState: U`, `abstractGameState: Final`) is neither live nor completed, so its last plays aren't ingested until it resumes and finishes.
  - Filter by `gameType`: `R` is regular season, `S` spring, `F`/`D`/`L`/`W` postseason.

## Implementation

### Schema

TypeScript writes two tables. SQL derives the rest. Every table has `season`. DDL lives in ordered files under `sql/`.

- **`raw_game_feeds`** (TS): `game_pk` PK, `season`, `feed_ts`, `fetched_at`, `json JSON`. Holds the latest feed per game, replaced only by a newer `feed_ts`.
- **`games`** (TS): `game_pk` PK, `season`, `official_date`, `game_type`, `game_number`, `abstract_state`, `coded_state`, `detailed_state`, `home_team_id`, `away_team_id`, `home_score`, `away_score`, `inning`, `inning_half`, `start_utc`, `venue_name`, `home_record`, `away_record`, `updated_at`.
- **`plays`** (SQL): one row per completed play, keyed by `(game_pk, at_bat_index)`.
- **`pitches`** (SQL): keyed by `(game_pk, at_bat_index, pitch_index)`, because `playId` can be null.
- **`players`** (SQL): the latest row per player, taken from `gameData`.
- **`teams`** (SQL): the latest row per team and season, taken from `gameData`.

Derived tables are real tables, not views, because a view would re-parse the JSON on every query. `sql/derive.sql` parses a game's feed once with `json_transform` into a temp table, then deletes and re-inserts that game's rows. Players and teams come only from feeds that have plays.

### Events

All events are defined with `eventType` and a Zod schema, so they are validated when sent and when they trigger a function.

- `mlb/season.backfill.requested` `{ season: number }`: sent by a person.
- `mlb/game-tables.rebuild.requested` `{}`: sent by a person.
- `mlb/game.completed` `{ gamePk: number }`
- `mlb/game.updated` `{ gamePk: number }`: a live game changed.
- `mlb/game-feed.stored` `{ gamePk: number }`

Events carry ids only. Feeds exceed the free tier's 256 KB event limit.

Every emitted event has a deterministic id, `<event>-<key>[-<discriminator>]`. The discriminator is what makes a repeat distinct: the feed version for ingest, and the request time for backfill and rebuild. Inngest drops a second event with the same id for 24 hours, so retries and overlapping runs don't repeat work.

| Emitted by | Event | Id |
| --- | --- | --- |
| `sync-schedule` | `mlb/game.completed` | `game-completed-{gamePk}` |
| `sync-schedule` | `mlb/game.updated` | `game-updated-{gamePk}-{event.ts}` |
| `backfill-season` | `mlb/game.completed` | `game-completed-{gamePk}-{event.ts}` |
| `ingest-game-feed` | `mlb/game-feed.stored` | `game-feed-stored-{gamePk}-{feedTs}` |
| `rebuild-game-tables` | `mlb/game-feed.stored` | `game-feed-stored-{gamePk}-{event.ts}` |

`event.ts` is when the person sent the request, or the scheduled minute for a cron run, so it is stable across retries of that run but new for each request or run.

### Naming

- Function id is `verb-object`, matching its file name.
- Events are `mlb/<noun>.<past-tense>`, or `mlb/<noun>.<verb>.requested` when a person asks for something. Compound nouns are hyphenated, as in `game-feed`.
- Step ids say what the step does with one of six verbs: `fetch-<source>` calls an API and returns the parsed, trimmed result; `upsert-<table>` writes rows; `load-<source>` fetches and writes in one step, only when the payload is too large for Inngest state; `derive-<thing>` transforms; `list-<source>` reads; and `emit-<event>` sends an event.
- Put each I/O phase in its own step, so a retry redoes as little as possible. Keep step outputs small.
- Functions return what they processed and counts, never arrays.

### Functions

All functions open a short-lived database connection per step with `withConnection`.

- **`sync-schedule`**
  - Cron, every minute, limited to baseball months and hours: `TZ=UTC * 15-23,0-7 * 2-11 *` (February–November, about 11am–4am ET). `singleton: { mode: "skip" }` skips a run while the previous one is still going, so a run stuck retrying blocks the minutes after it.
  - Step `fetch-schedule`: one schedule call for yesterday and today (US Eastern), which catches late-running and resumed games. No future fetch: tomorrow's games appear once the date rolls over. Returns the parsed rows, about 15 KB.
  - Step `upsert-games`: upsert only the `games` rows that changed, and return their ids.
  - Step `emit-game-completed`: `mlb/game.completed` for every completed game in the window. The id `game-completed-{gamePk}` has no time in it, so consecutive runs don't send it again. A game still in the window after 24 hours is sent once more, which is harmless because ingest is idempotent.
  - Step `emit-game-updated`: `mlb/game.updated` for every live game whose `games` row changed in this run: score, inning, outs, runners and so on. Completed games are left to `mlb/game.completed`. The id includes `event.ts`, so retries of a run don't send it again.
  - Returns `{ startDate, endDate, games, changed, completed, updated }`.
- **`backfill-season`**
  - Triggered by `mlb/season.backfill.requested`.
  - Step `fetch-season-dates`: the season's date range.
  - Step `fetch-schedule`: one schedule call over that range. Returns the parsed rows, about 1 MB for a full season, well under Inngest's 4 MB step limit.
  - Step `upsert-games`: upsert only the `games` rows that changed.
  - Step `emit-game-completed`: one `step.sendEvent` of `mlb/game.completed` for every completed game (under the 5,000-per-send limit). The id includes `event.ts`, so re-sending the request re-checks every game.
  - Returns `{ season, games, changed, completed }`.
- **`ingest-game-feed`**
  - Triggered by `mlb/game.completed` or `mlb/game.updated`, with concurrency 2 to stay polite to MLB's API.
  - Step `load-game-feed`: fetch the feed and upsert `raw_game_feeds`, skipped unless `feed_ts` is newer than the stored one. `feed_ts` is `YYYYMMDD_HHMMSS`, so text comparison orders it, and a late older feed never replaces a newer one. Only a summary is returned, which keeps the 670 KB feed out of Inngest state.
  - Step `emit-game-feed-stored`: emits `mlb/game-feed.stored` only when the feed was stored, so an unchanged or older feed causes no derive. To re-run a derive that ran out of retries, replay the run from the Inngest dashboard or send `mlb/game-tables.rebuild.requested`, whose ids use `event.ts`.
  - Inngest retries handle MLB errors, and a 429 with `Retry-After` becomes a `RetryAfterError`.
  - Returns `{ gamePk, feedTs, status }`.
- **`derive-game-tables`**
  - Triggered by `mlb/game-feed.stored`, with concurrency 1 so derives never conflict on `players` and `teams`.
  - Debounced per game for 30 seconds (at most 2 minutes), so a live game's frequent feed updates collapse into one derive of the latest feed instead of piling up in the queue.
  - Step `derive-game`: runs `derive.sql` for one game in a transaction. A failure leaves the previous rows in place, and Inngest retries it without refetching the feed.
  - Returns `{ gamePk, plays, pitches }`.
- **`rebuild-game-tables`**
  - Triggered by `mlb/game-tables.rebuild.requested`.
  - Step `list-raw-feeds`: every `game_pk` in `raw_game_feeds`.
  - Steps `emit-game-feed-stored-1`, `emit-game-feed-stored-2`, …: `mlb/game-feed.stored` for each game, at most 5,000 per send, one numbered step per batch.
  - Returns `{ feeds }`.

### Config

- `DUCKDB_URL`: `md:bullpen_dev`, `md:bullpen` or a local file path.
- `MOTHERDUCK_TOKEN`
- `INNGEST_DEV=1` locally; `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` in prod.

All live in `.env.local`, which is gitignored.

## Testing

- **`derive.sql`**: run it on saved feed fixtures, including a doubleheader, a postponed game, a suspended game and an extra-innings game. Row counts and final scores should match the box score. Re-deriving leaves the row counts unchanged, a failed derive keeps the previous rows, and an older feed never replaces a newer one.
- **Schedule**: parsing, which rows count as changed, and which games count as completed, including a forfeit and a postponed game.
- **Functions**: `@inngest/test` runs each function that sends events, with its steps mocked, and checks the events and their ids. `sync-schedule` emits `mlb/game.updated` only for changed live games and not at all when nothing changed, `ingest-game-feed` emits only for a stored feed and runs on `mlb/game.updated`, and `rebuild-game-tables` splits its events into batches of 5,000.

## Alternatives

- **Materialized views:** neither DuckDB nor MotherDuck supports them. Event-driven `derive.sql` refreshes rows exactly when data lands.
- **A dedicated MLB fetcher function:** unnecessary at this volume. Inngest retries handle rate limiting.
- **A per-game live tracker:** it would hit the 1,000-step limit and adds complexity. A one-minute cron covers the scoreboard.
- **Scheduling polls with `step.sleepUntil` at each first pitch:** precise, but more moving parts than a cron window.
- **Raw JSON in object storage:** cheaper, but adds a system. MotherDuck keeps the raw data queryable in SQL.
- **A self-hosted DuckDB server (Quack):** it needs a long-running process and won't be production-ready until DuckDB v2.0. MotherDuck replaces it.
- **Normalizing in TypeScript:** more code than SQL `unnest` over JSON, and slower to change.

## References

- [asbeane/mlb-stats-api](https://github.com/asbeane/mlb-stats-api)
- [Inngest TypeScript SDK](https://www.inngest.com/docs/typescript)
- [Inngest usage limits](https://www.inngest.com/docs/usage-limits/inngest)
- [Inngest concurrency](https://www.inngest.com/docs/guides/concurrency)
- [Inngest scheduled functions](https://www.inngest.com/docs/guides/scheduled-functions)
- [DuckDB Quack remote protocol](https://duckdb.org/2026/05/12/quack-remote-protocol)
- [MotherDuck: materialized views](https://motherduck.com/glossary/materialized-view/)
