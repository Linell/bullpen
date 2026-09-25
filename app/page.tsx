import { Suspense } from "react";
import { connection } from "next/server";
import { Scoreboard, ScoreboardSkeleton } from "@/components/scoreboard";
import { todayOfficialDate } from "@/lib/dates";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<ScoreboardSkeleton />}>
        <TodayScoreboard />
      </Suspense>
    </main>
  );
}

async function TodayScoreboard() {
  await connection();
  return <Scoreboard date={todayOfficialDate()} isToday />;
}
