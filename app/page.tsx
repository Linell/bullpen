import { GameCard } from "@/components/game-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { formatToday } from "@/lib/format";
import { getTodaysGames } from "@/lib/games";

export default async function Home() {
  const games = await getTodaysGames();
  const liveCount = games.filter((g) => g.status.state === "live").length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="rounded-base border-2 border-border bg-main px-3 py-1 text-xl font-heading text-main-foreground shadow-shadow">
          Bullpen
        </span>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pt-6 pb-24">
        <section className="flex flex-col gap-1">
          <h1 className="text-4xl">Today&apos;s games</h1>
          <p className="opacity-70">
            {formatToday()} · {games.length} games
            {liveCount > 0 && ` · ${liveCount} live`}
          </p>
        </section>
        {games.length > 0 ? (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </section>
        ) : (
          <Card>
            <CardContent>No games on the schedule today.</CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
