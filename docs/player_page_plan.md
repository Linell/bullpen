# Bullpen: player page plan

Builds on `player_page_proposal.md` (what the page shows). This covers how to build it.

## Principles

- SQL defines event meaning at derive time. TypeScript sums counts and computes display rates. The Python app owns percentiles, rolling form and modeling, and writes its own tables.
- Named query functions over plain tables. No query builder.
- Every rendered name carries an id. Season lives in the path; analysis filters live in searchParams.

## 1. Data (`sql/012_*.sql`, `derive.sql`)

- `plate_appearances`: one row per PA with runs, outs, is_pa, is_at_bat, bases, bat_side, pitch_hand, by_starter. `is_pa` is an allow-list, with a test that fails on unknown event types.
- `pitch_outcomes` view: is_swing, is_whiff, in_zone, is_fastball, grouped on each pitch's own pitcher and batter.
- `player_game_batting` / `player_game_pitching`: from box score stats, giving official R, ER, IP, PA, AB, H, BB, K.
- Rebuild from stored feeds.

## 2. Stat layer (`lib/stats/`)

- `sql.ts`: totals fragments. `rates.ts`: display rates (AVG, OPS, K%).
- `hitting.ts`: `hitterSeason`, `hitterSplits`, `hitterGameLog`, `hitterYears`.
- `pitching.ts`: the same four, plus `pitcherArsenal`. Pitcher splits use `bat_side`.
- `team.ts`: `getTeamStats` ported onto the new tables.
- Values are always `$params`.
- Cache tags: `player:{id}:{season}` (from `game_players`), plus `season-stats:{season}` for league baselines.

## 3. Verification

- Team page numbers are unchanged, except runs allowed.
- Each player's PA totals match the box score for every game.
- A fixture with a mid-PA pitching change and inherited runners.
- Spot-check 3 hitters, 3 pitchers and Ohtani against Baseball Savant.

## 4. Links

- `lib/routes.ts` (`playerPath`, `teamPath`, `gamePath`) and `PlayerLink`.
- Carry ids through starters, decisions, play-by-play, probables, team leaders and relievers.
- Links inherit the season of the page they're on (team season → player season, game → game's season).

## 5. Routes

```
app/players/[playerId]/
  layout.tsx               header · SeasonSwitcher · role tabs (Links)
  page.tsx                 → redirect to primary role
  hitting/[[...season]]/
  pitching/[[...season]]/
```

- No season in the URL means the player's latest season with data.
- Tabs show only for roles the player has data for.

## 6. Page slices

1. Header, season line, game log.
2. Splits, arsenal or batted ball, year by year.
3. Percentiles and rolling form, from Python, after the backfill.

## 7. Season switching

- A shared `SeasonSwitcher` for teams and players: prev/next arrows, `[` and `]` keys, prefetch on neighboring seasons.
- Year-by-year rows link to that season.
- Later: a career view and `?from=&to=` ranges.

## Order

Data tables → stat layer and team port → links → player routes → page slices.
