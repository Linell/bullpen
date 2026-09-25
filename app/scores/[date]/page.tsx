import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Scoreboard, ScoreboardSkeleton } from "@/components/scoreboard";
import { isOfficialDate, shiftDate, todayOfficialDate } from "@/lib/dates";

export function generateStaticParams() {
  const today = todayOfficialDate();
  return [1, 2, 3].map((daysAgo) => ({ date: shiftDate(today, -daysAgo) }));
}

export default function ScoresPage({ params }: PageProps<"/scores/[date]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<ScoreboardSkeleton />}>
        <DateScoreboard params={params} />
      </Suspense>
    </main>
  );
}

async function DateScoreboard({ params }: Pick<PageProps<"/scores/[date]">, "params">) {
  const { date } = await params;
  if (!isOfficialDate(date)) notFound();
  return <Scoreboard date={date} />;
}
