import { Suspense } from "react";
import { connection } from "next/server";
import { DailyLeaders, DailyLeadersSkeleton } from "@/components/daily-leaders";
import { Scoreboard, ScoreboardSkeleton } from "@/components/scoreboard";
import { todayOfficialDate } from "@/lib/dates";

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-(--breakpoint-2xl) flex-1 content-start gap-6 px-6 pt-6 pb-24 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="@container flex min-w-0 flex-col gap-6">
        <Suspense fallback={<ScoreboardSkeleton />}>
          <TodayScoreboard />
        </Suspense>
      </div>
      <aside>
        <Suspense fallback={<DailyLeadersSkeleton />}>
          <TodayLeaders />
        </Suspense>
      </aside>
    </main>
  );
}

async function TodayScoreboard() {
  await connection();
  return <Scoreboard date={todayOfficialDate()} isToday />;
}

async function TodayLeaders() {
  await connection();
  return <DailyLeaders date={todayOfficialDate()} />;
}
