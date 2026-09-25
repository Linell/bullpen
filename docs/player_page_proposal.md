# Bullpen: player page proposal

## Problem

- Player names appear on game pages, team leaderboards and probables, but none of them link anywhere. There is no place to see how a player is doing.
- A player page is the first thing people look up on a baseball site, and later features (search, leaderboards, comparisons) build on it.
- The page has to show a lot of data without becoming cluttered, and work on a phone.

## Solution

Add `/players/[playerId]` and `/players/[playerId]/[season]`, matching the team routes. The page is ordered by how often people look for each thing:

1. **Header**: name, number, position, team, B/T, age, height/weight. If the player is in today's game, show the matchup (probable starter, first pitch) or his live line.
2. **Season line**: six headline stats, each with its league rank.
3. **Profile and recent form**, side by side on desktop and stacked on mobile:
   - Percentile sliders grouped by skill (contact quality, discipline, stuff).
   - A last 7 / 15 / 30 games toggle with a rolling chart against the league line, plus a last-5-games table.
4. **Accordion** for the deeper sections: Splits, Batted ball or Arsenal, Plate discipline, Game log, Year by year.

The page adapts to the player's role:

- **Hitters**: headline stats are PA, AVG/OBP/SLG, OPS, HR, K% and BB%. Batted ball starts open.
- **Pitchers**: headline stats are IP, RA9, WHIP, K%, BB%, CSW% and FB velo. Arsenal starts open.
- **Two-way players**: a Hitting/Pitching toggle in the header.

Every player name on the site becomes a `PlayerLink`, matching the existing `TeamLink`.

```
┌ Aaron Judge  #99 RF · NYY · B/T R/R · 34 · 6'7" 282 ─ [Hitting|Pitching]* ┐
│ Tonight @ BOS 7:10 vs. Bello (RHP)                   ← or live line if in game
├──────────────────────────────────────────────────────────────────────────────┤
│ PA 512 │ .301/.412/.620 │ OPS 1.032 │ HR 41 │ K% 24 │ BB% 16   ← each: rank │
├────────────── Profile (percentile sliders) ─────┬──── Recent form ──────────┤
│ Hard-hit%  ████████████░ 97                      │ [L7|L15|L30]              │
│ Exit velo  ████████████░ 99                      │ rolling OPS vs lg line    │
│ Chase%     █████████░░░░ 74                      │ last 5 games mini-table   │
│ K%         ████░░░░░░░░░ 31                      │                           │
├──────────────────────────────────────────────────┴───────────────────────────┤
│ ▸ Splits           vs L/R · home/away · RISP · by month                     │
│ ▾ Batted ball      spray chart · EV/LA · results by pitch type   (open)     │
│ ▸ Plate discipline zone heatmap · swing/whiff by zone                       │
│ ▸ Game log         full sortable table                                      │
│ ▸ Year by year     (after backfill)                                         │
└──────────────────────────────────────────────────────────────────────────────┘
* the toggle only appears for two-way players
```

## Out of scope

- Headshots and other images.
- WAR, expected stats (xwOBA, xBA), sprint speed, defense and minor-league stats. We don't have the data.
- Awards, transactions, contracts and news.
- Player search and leaderboards. They come next and reuse this page's queries.
- Player comparison.

## Risks

- **Percentiles need a full league pool.** With only part of a season loaded, the ranks are misleading. Mitigation: show percentiles only for seasons that are fully backfilled.
- **Players have no per-season bio.** `players` holds one row per player and the newest feed wins, because feeds only carry each player's current bio. Mitigation: take number, position and team from `game_players`, which records what each player had in each game, and keep only the bio in `players`.
- **Query cost.** Each section is an aggregate over `plays` and `pitches`. Mitigation: cache per player and season with a tag, the same way team stats are cached, and invalidate it from `mlb/game-tables.derived`.
- **Clutter creep.** Every section wants to start open. Mitigation: only the role-specific section starts open, and the rest must earn a spot through usage.

## Release

1. Rebuild the derived tables from stored feeds, so every game has `game_players` rows.
2. Backfill prior seasons (see the backfill plan).
3. Ship the page behind its route, without adding links yet, and check it against Baseball Savant for a few hitters, pitchers and Ohtani.
4. Add `PlayerLink` everywhere names appear.

## Blocked by

- `game_players` rows for every stored game. Hard blocker for the header and the season route.
- The season backfill. Hard blocker for percentiles and the Year by year section; the rest of the page can ship with 2026 only.
- A decision on percentile qualifiers (see Implementation).

## Context

### What people look for

Every major site puts the current-season line and recent games first. In the evidence we found (forum threads, product blogs, vendor posts), people check these most often, in order:

1. This season's line, compared with the league.
2. Recent form.
3. Splits, especially vs L/R, and pitch mix.
4. The game log.
5. Deeper profile: arsenal, batted ball, zone.
6. Year by year.

### How other sites do it

- **Baseball Savant** leads with percentile sliders grouped by skill, then pitch usage, movement and arsenal for pitchers, or spray and batted-ball charts for hitters. It is praised as the fastest way to see what kind of player someone is, and criticized as poor on mobile.
- **FanGraphs** uses a 20-column dashboard and a menu of about 15 sub-tables. Its defaults depend on the role: pitchers see their repertoire, and minors are hidden for veterans. Its stat-over-time graphs are widely praised.
- **Baseball-Reference** is a long scroll of tables with a pinned season-vs-career summary and an "On this page" sidebar. People use it by default for quick lookups.
- **MLB.com** shows collapsible last 3/7/15-game blocks.
- **ESPN** puts a league rank next to each headline stat ("OPS .901, 4th").

Ideas we take:

- Savant's sliders.
- ESPN's ranks.
- FanGraphs' role-aware defaults.
- MLB.com's recent-form blocks.

We also make sure the page works on mobile, which Savant doesn't.

### What we can do that they don't

- Today's context in the header. Competitor player pages are static references.
- ABS challenge record per player, which is new in 2026 and already stored.

## Implementation

### Data

Most of the queries already exist for teams in `lib/team-stats.ts`. They need a player filter instead of a team filter:

- `leadersQuery(role)` already groups by `batter_id` or `pitcher_id`.
- The splits query (GROUPING SETS for vs L/R, home/away, RISP, bases empty) and the pitch-mix query can be reused.
- `PITCH_FLAGS`, `PLATE_APPEARANCES`, `BATTING_TOTALS`, `PITCHING_TOTALS` and the `toBattingStats` / `toPitchingStats` helpers can be reused.
- The ABS and reliever workload queries in `lib/team-trends.ts` adapt to a single pitcher.

New work:

- **Spray chart**: from `plays.hit_coord_x/y`, drawn as custom SVG like `diamond.tsx`.
- **Barrels**: computed from launch speed and angle.
- **Rolling form**: a window over games, like the run differential chart.
- **Percentiles**: `percent_rank()` over qualified players in the season.
- **Number, position and team**: from the player's latest `game_players` row in the season.

### Percentile qualifiers

These are proposed defaults, still undecided. They are Savant's thresholds, and they let relievers qualify:

- **Hitters**: 2.1 PA per team game.
- **Pitchers**: 1.25 batters faced per team game.

Players below the line see grey sliders marked "not qualified". The 2020 season works because the thresholds are per team game.

### UI

Already installed: `badge`, `card`, `chart`, `table`, `tooltip`, `skeleton`, `abbr`.

Add from neobrutalism (built on `@base-ui/react`, which is already installed):

- **accordion**: with `multiple`, and `defaultValue` set to the role's section.
- **tabs**: for the Hitting/Pitching toggle.
- **toggle-group**: for L7/L15/L30.
- **progress**: for the sliders.
- **scroll-area**: for wide tables on mobile.

Charts:

- Line: rolling form.
- Horizontal bar: pitch usage.
- Recharts scatter through the existing `chart` wrapper: movement plot.

Every stat label goes through the glossary, as on team pages.

### Links

Add `PlayerLink` next to `TeamLink`. Most loaders return names without ids, so they need `batter_id` / `pitcher_id` added:

- Play-by-play: `components/play-by-play.tsx`, `lib/game-detail.ts`.
- Decisions: `components/game-header.tsx`.
- Starters and probables: `components/starters.tsx`, `components/game-card.tsx`, `lib/scoreboard.ts`.
- Team leaders and bullpen workload, which already have ids.

## Testing

- Stat queries: one hitter and one pitcher from a fixture feed, checked against the box score.
- Percentiles: qualification cutoff and ties.
- Role detection: a hitter, a pitcher and a two-way player each open the right default section.
- Unknown players and seasons without data return real 404s, as teams do.

## Alternatives

- **Tabs for every section** (the Savant and ESPN approach). This hides the deeper sections behind clicks and doesn't let you compare two at once. An accordion keeps everything on one page and lets several sections stay open.
- **One long scroll of tables** (the Baseball-Reference approach). It is dense and fast to scan once you know it, but cluttered for everyone else and poor on mobile.
- **Pulling bio and team from `/api/v1/people/{id}`.** It gives richer bio data and a current team, but adds a second data source and more API calls. The feeds already carry what we show.

## References

- [Baseball Savant: Ohtani](https://baseballsavant.mlb.com/savant-player/shohei-ohtani-660271), [MLB.com on the Savant redesign](https://www.mlb.com/news/baseball-savant-statcast-player-pages-new-look)
- [FanGraphs: Judge](https://www.fangraphs.com/players/aaron-judge/15640/stats), [updated player pages](https://blogs.fangraphs.com/updated-player-pages-are-here/)
- [Baseball-Reference: Skubal](https://www.baseball-reference.com/players/s/skubata01.shtml), [in-page navigation redesign](https://www.sports-reference.com/blog/2026/02/in-page-navigation-redesign-on-baseball-reference/)
- [MLB.com: Ohtani](https://www.mlb.com/player/shohei-ohtani-660271), [ESPN: Ohtani](https://www.espn.com/mlb/player/_/id/39832/shohei-ohtani)
- [Twins Daily thread comparing stat sites](https://twinsdaily.com/forums/topic/60508-fangraphs-baseball-reference-baseball-savant-other/)
- [neobrutalism charts](https://www.neobrutalism.dev/charts), [accordion](https://www.neobrutalism.dev/docs/accordion)
