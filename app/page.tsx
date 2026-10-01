import { Suspense } from "react";
import { connection } from "next/server";
import { DailyLeaders, DailyLeadersSkeleton } from "@/components/daily-leaders";
import { PageMain } from "@/components/page-main";
import { Scoreboard, ScoreboardSkeleton } from "@/components/scoreboard";
import { todayOfficialDate } from "@/lib/dates";

export default function Home() {
  return (
    <PageMain className="grid content-start xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="@container flex min-w-0 flex-col gap-6">
        <Suspense fallback={<ScoreboardSkeleton title="Today" />}>
          <TodayScoreboard />
        </Suspense>
      </div>
      <aside aria-label="Today's leaders">
        <Suspense fallback={<DailyLeadersSkeleton />}>
          <TodayLeaders />
        </Suspense>
      </aside>
    </PageMain>
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
