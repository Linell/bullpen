import { Suspense } from "react";
import type { Metadata } from "next";
import { BarrelBoard, EventBoard, HittingBoard, PitchingBoard, WhiffBoard } from "@/components/leaderboard";
import { LeaderboardNav } from "@/components/leaderboard-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { todayOfficialDate } from "@/lib/dates";
import { parseLeaderboardSearch, rangeDates } from "@/lib/leaderboard-range";
import {
  BATTED_BALLS_PER_GAME_DAY,
  barrelRates,
  fastestPitches,
  hardestHitBalls,
  hittingLeaders,
  INNINGS_PER_GAME_DAY,
  longestHomeRuns,
  PITCHES_PER_GAME_DAY,
  pitchingLeaders,
  PLATE_APPEARANCES_PER_GAME_DAY,
  whiffRates,
} from "@/lib/stats/leaderboards";

export const metadata: Metadata = { title: "Leaders" };

const GRID = "grid gap-6 xl:grid-cols-2";

export default function LeadersPage({ searchParams }: PageProps<"/leaders">) {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <h1>Leaders</h1>
      <Suspense fallback={<LeaderboardsSkeleton />}>
        <Leaderboards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Leaderboards({ searchParams }: Pick<PageProps<"/leaders">, "searchParams">) {
  const search = parseLeaderboardSearch(await searchParams);
  const query = { ...rangeDates(search.range, todayOfficialDate()), limit: search.limit };
  const season = Number(query.to.slice(0, 4));
  const [hitters, pitchers, homeRuns, pitches, battedBalls, barrels, whiffs] = await Promise.all([
    hittingLeaders(query),
    pitchingLeaders(query),
    longestHomeRuns(query),
    fastestPitches(query),
    hardestHitBalls(query),
    barrelRates(query),
    whiffRates(query),
  ]);

  return (
    <>
      <LeaderboardNav {...search} />
      <div className={GRID}>
        <HittingBoard leaders={hitters} season={season} />
        <PitchingBoard leaders={pitchers} season={season} />
        <EventBoard
          title="Longest home runs"
          leaders={homeRuns}
          role="hitting"
          season={season}
          valueLabel="Distance"
          digits={0}
        />
        <EventBoard
          title="Fastest pitches"
          leaders={pitches}
          role="pitching"
          season={season}
          valueLabel="MPH"
          digits={1}
        />
        <EventBoard
          title="Hardest-hit balls"
          leaders={battedBalls}
          role="hitting"
          season={season}
          valueLabel="MPH"
          digits={1}
        />
        <BarrelBoard leaders={barrels} season={season} />
        <WhiffBoard leaders={whiffs} season={season} />
      </div>
      <p className="text-sm opacity-70">
        Per game day in the range, hitters need {PLATE_APPEARANCES_PER_GAME_DAY} plate appearances, pitchers{" "}
        {INNINGS_PER_GAME_DAY} inning, barrel rate {BATTED_BALLS_PER_GAME_DAY} batted ball and whiff rate{" "}
        {PITCHES_PER_GAME_DAY} pitches.
      </p>
    </>
  );
}

function LeaderboardsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-96 max-w-full" />
      <div className={GRID}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </>
  );
}
