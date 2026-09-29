import { Suspense } from "react";
import type { Metadata } from "next";
import { BarrelBoard, EventBoard, WhiffBoard } from "@/components/leaderboard";
import { LeaderboardNav } from "@/components/leaderboard-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { todayOfficialDate } from "@/lib/dates";
import { parseLeaderboardSearch, rangeDates } from "@/lib/leaderboard-range";
import { barrelRates, fastestPitches, hardestHitBalls, longestHomeRuns, whiffRates } from "@/lib/stats/leaderboards";

export const metadata: Metadata = { title: "Leaders" };

const GRID = "grid gap-6 xl:grid-cols-2";

export default function LeadersPage({ searchParams }: PageProps<"/leaders">) {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <h1 className="text-3xl">Leaders</h1>
      <Suspense fallback={<LeaderboardsSkeleton />}>
        <Leaderboards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Leaderboards({ searchParams }: Pick<PageProps<"/leaders">, "searchParams">) {
  const search = parseLeaderboardSearch(await searchParams);
  const range = { ...rangeDates(search.range, todayOfficialDate()), limit: search.limit };
  const [homeRuns, pitches, battedBalls, barrels, whiffs] = await Promise.all([
    longestHomeRuns(range),
    fastestPitches(range),
    hardestHitBalls(range),
    barrelRates(range),
    whiffRates(range),
  ]);

  return (
    <>
      <LeaderboardNav {...search} />
      <div className={GRID}>
        <EventBoard title="Longest home runs" leaders={homeRuns} role="hitting" valueLabel="Distance" digits={0} />
        <EventBoard title="Fastest pitches" leaders={pitches} role="pitching" valueLabel="MPH" digits={1} />
        <EventBoard title="Hardest-hit balls" leaders={battedBalls} role="hitting" valueLabel="MPH" digits={1} />
        <BarrelBoard leaders={barrels} />
        <WhiffBoard leaders={whiffs} />
      </div>
      <p className="text-sm opacity-70">Rate boards require at least 1 batted ball or 10 pitches per game day in the range.</p>
    </>
  );
}

function LeaderboardsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-96 max-w-full" />
      <div className={GRID}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </>
  );
}
