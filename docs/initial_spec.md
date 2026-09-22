# Bullpen: MLB ingest and live scores spec

## Problem

- We can't see which MLB games are live today, or their scores.
- We have no queryable 2026 season dataset (games, plate appearances, pitches) for analytics.
- The only source is MLB's unofficial Stats API, so we must fetch politely and avoid re-fetching data we already have.

## Solution

Three Inngest functions and two typed events feed a MotherDuck database. Raw game JSON is the source of truth, and analytics tables are derived from it in SQL.

- **`scoreboard`** runs every minute during baseball months and hours. One schedule request returns every game's status and score. It updates `games`, pushes changes to the UI, and emits `mlb/game.final` when a game ends.
- **`backfill-season`** emits `mlb/game.final` for every completed game in a season.
- **`ingest-game`** fetches a final game's feed, stores the raw JSON, and runs `derive.sql` to rebuild that game's rows.

Live and backfill share one ingest path. Re-running anything is safe, because unchanged feeds are skipped.

## Out of scope

- Seasons before 2026. The schema supports them, and loading one later is just another backfill event.
- Pitch-by-pitch live updates. Live scores refresh once a minute.
- Analytics UI and models.
- Automatic rechecks for scorer corrections. Re-run the backfill instead.

## Risks

- **Unofficial API.** MLB's API has no SLA and its fields change; ABS challenges were added in 2026, for example. Mitigation: store the raw JSON so tables can be rebuilt without re-fetching.
- **Usage terms.** MLB's copyright notice limits use to individual, non-commercial purposes. The project stays personal.
- **Native binary.** `@duckdb/node-api` may not run on serverless platforms. Verify on the deploy target early.
- **Local single writer.** An offline `.duckdb` file allows one writer at a time, so set ingest concurrency to 1 when using it.

## Release

1. Build against `md:bullpen_dev` with the local Inngest dev server.
2. Ingest a handful of final games and check the counts against MLB's box scores.
3. Backfill the 2026 season in dev.
4. Point prod at `md:bullpen`, deploy, and run the backfill there.

Rollback: the derived tables can be dropped and rebuilt from `raw_game_feeds`.

## Context

- **Schedule** (`/api/v1/schedule?sportId=1&date=…&hydrate=linescore`) returns every game's `gamePk`, status and score in one call. It also accepts `startDate`/`endDate`.
- **Game feed** (`/api/v1.1/game/{gamePk}/feed/live`, about 670 KB) has pitch-level data: velocity, spin, movement and location, plus exit velocity and launch angle on balls in play. It also includes weather, umpires, box score and ABS challenges. `metaData.timeStamp` identifies the feed version.
- A season is about 2,430 games, 185k plate appearances and 700k pitches.
- Gotchas:
  - `gameDate` is UTC. Bucket games by `officialDate`.
  - Doubleheaders have separate `gamePk`s; use `gameNumber` to tell them apart.
  - Postponed games show `abstractGameState: Final` with `codedGameState: D`. Use `codedGameState` in `F`/`O` to mean "actually played."
  - Suspended games span dates. Key everything by `gamePk`.
  - Filter by `gameType`: `R` is regular season, `S` spring, `F`/`D`/`L`/`W` postseason.

## Implementation

### Schema

TypeScript writes two tables. SQL derives the rest. Every table has `season`. DDL lives in ordered files under `sql/`.

- **`raw_game_feeds`** (TS): `game_pk` PK, `season`, `feed_ts`, `fetched_at`, `json JSON`. Holds the latest feed per game, replaced when `feed_ts` changes.
- **`games`** (TS): `game_pk` PK, `season`, `official_date`, `game_type`, `game_number`, `abstract_state`, `coded_state`, `detailed_state`, `home_team_id`, `away_team_id`, `home_score`, `away_score`, `inning`, `inning_half`, `start_utc`, `updated_at`.
- **`plate_appearances`** (SQL): keyed by `(game_pk, at_bat_index)`.
- **`pitches`** (SQL): keyed by `(game_pk, at_bat_index, pitch_index)`, because `playId` can be null.
- **`players`, `teams`** (SQL): the latest row per id, taken from `gameData`.

Derived tables are real tables, not views, because a view would re-parse the JSON on every query. `sql/derive.sql` deletes and re-inserts one game's rows. Run without the game filter, the same SQL rebuilds everything.

### Events

Both events are defined with the Inngest TS SDK's typed event schemas.

- `mlb/season.backfill.requested` `{ season: number, gameTypes?: string[] }`: validate with Zod, because a person sends it.
- `mlb/game.final` `{ gamePk: number, season: number }`

Events carry ids only. Feeds exceed the free tier's 256 KB event limit.

### Functions

- **`scoreboard`**
  - Cron, every minute, limited to baseball months and hours: `TZ=UTC * 15-23,0-7 * 2-11 *` (February–November, about 11am–4am ET).
  - One schedule call for yesterday and today, which catches late-running and resumed games. Do we need a future fetch, too?
  - Upsert `games`, and publish to Inngest Realtime only for rows that changed.
  - Emit `mlb/game.final` when `coded_state` becomes `F` or `O`.
- **`backfill-season`**
  - One schedule call over the season's date range.
  - Upsert `games`, then one `step.sendEvent` of `mlb/game.final` for every completed game (under the 5,000-per-send limit).
- **`ingest-game`**
  - Triggered by `mlb/game.final`, with concurrency 2 (1 offline).
  - One step: fetch the feed, skip if `feed_ts` is unchanged, upsert raw, run `derive.sql`.
  - Returns only a summary, which keeps the 670 KB feed out of Inngest state.
  - Inngest retries handle MLB errors.

### Config

- `DUCKDB_URL`: `md:bullpen_dev`, `md:bullpen` or a local file path.
- `MOTHERDUCK_TOKEN`

Both live in `.env.local`, which is gitignored.

## Testing

- **`derive.sql`**: run it on saved feed fixtures, including a doubleheader, a postponed game, a suspended game and an extra-innings game. Row counts and final scores should match the box score.
- **`scoreboard`**: the status-transition logic emits `game.final` only for `F`/`O`, and only once per game.
- **Idempotency**: ingesting the same game twice leaves the row counts unchanged.

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
- [Inngest Realtime](https://www.inngest.com/docs/features/realtime)
- [DuckDB Quack remote protocol](https://duckdb.org/2026/05/12/quack-remote-protocol)
- [MotherDuck: materialized views](https://motherduck.com/glossary/materialized-view/)
