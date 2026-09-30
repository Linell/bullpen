import { DateNav } from "@/components/date-nav";
import { GameCardSkeleton } from "@/components/game-card";
import { GameGrid } from "@/components/game-grid";
import { GameRowSkeleton } from "@/components/game-row";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatOfficialDate } from "@/lib/dates";
import { getGames } from "@/lib/games";

export async function Scoreboard({ date, isToday = false }: { date: string; isToday?: boolean }) {
  const games = await getGames(date);
  const hasUnfinishedGames = games.some((game) => !game.completed);
  const rounds = [...new Set(games.map((game) => game.postseason).filter(Boolean))];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl">{isToday ? "Today" : formatOfficialDate(date)}</h1>
          {rounds.length > 0 && <p className="text-xl font-heading opacity-70">{rounds.join(" · ")}</p>}
        </div>
        <DateNav date={date} isToday={isToday} />
      </div>
      {games.length === 0 ? (
        <Card>
          <CardContent>{isToday ? "No games today." : "No games on this date."}</CardContent>
        </Card>
      ) : hasUnfinishedGames ? (
        <LiveScoreboard games={games} />
      ) : (
        <GameGrid games={games} />
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
      <section className="grid gap-6 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </section>
      <section className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <GameRowSkeleton key={i} />
        ))}
      </section>
    </>
  );
}
