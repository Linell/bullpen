import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageMain } from "@/components/page-main";
import { Scoreboard, ScoreboardSkeleton } from "@/components/scoreboard";
import { isOfficialDate, shiftDate, todayOfficialDate } from "@/lib/dates";

export function generateStaticParams() {
  const today = todayOfficialDate();
  return [1, 2, 3].map((daysAgo) => ({ date: shiftDate(today, -daysAgo) }));
}

export default function ScoresPage({ params }: PageProps<"/scores/[date]">) {
  return (
    <PageMain className="@container">
      <Suspense fallback={<ScoreboardSkeleton />}>
        <DateScoreboard params={params} />
      </Suspense>
    </PageMain>
  );
}

async function DateScoreboard({ params }: Pick<PageProps<"/scores/[date]">, "params">) {
  const { date } = await params;
  if (!isOfficialDate(date)) notFound();
  return <Scoreboard date={date} />;
}
