import { Suspense } from "react";
import { DateNav } from "@/components/date-nav";
import { Scoreboard } from "@/components/scoreboard";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardContent>Loading games…</CardContent>
    </Card>
  );
}
