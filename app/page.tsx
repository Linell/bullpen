import { Suspense } from "react";
import { connection } from "next/server";
import { DateNav } from "@/components/date-nav";
import { GameCardSkeleton } from "@/components/game-card";
import { Scoreboard } from "@/components/scoreboard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatOfficialDate, isOfficialDate, todayOfficialDate } from "@/lib/dates";
import { getGames } from "@/lib/games";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<GamesFallback />}>
        <Games searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Games({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { date: param } = await searchParams;
  await connection();
  const today = todayOfficialDate();
  const date = isOfficialDate(param) ? param : today;
  const isToday = date === today;
  const games = await getGames(date);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{isToday ? "Today" : `${formatOfficialDate(date)}`}</h1>
        <DateNav date={date} today={today} />
      </div>
      <Scoreboard
        games={games}
        emptyLabel={isToday ? "No games today." : "No games on this date."}
      />
    </>
  );
}

function GamesFallback() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-8 w-44" />
      </div>
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </section>
    </>
  );
}
