import { DateNav } from "@/components/date-nav";
import { GameCard, GameCardSkeleton } from "@/components/game-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatOfficialDate } from "@/lib/dates";
import { getGames } from "@/lib/games";

export async function Scoreboard({ date, isToday = false }: { date: string; isToday?: boolean }) {
  const games = await getGames(date);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{isToday ? "Today" : formatOfficialDate(date)}</h1>
        <DateNav date={date} isToday={isToday} />
      </div>
      {games.length > 0 ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>
      ) : (
        <Card>
          <CardContent>{isToday ? "No games today." : "No games on this date."}</CardContent>
        </Card>
      )}
    </>
  );
}

export function ScoreboardSkeleton() {
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
