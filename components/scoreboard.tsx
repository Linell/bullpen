import { GameCard } from "@/components/game-card";
import { Card, CardContent } from "@/components/ui/card";
import type { Game } from "@/lib/scoreboard";

export function Scoreboard({
  dateLabel,
  emptyLabel,
  games,
}: {
  dateLabel: string;
  emptyLabel: string;
  games: Game[];
}) {
  const liveCount = games.filter((g) => g.status.state === "live").length;

  return (
    <>
      <p className="opacity-70">
        {dateLabel} · {games.length} {games.length === 1 ? "game" : "games"}
        {liveCount > 0 && ` · ${liveCount} live`}
      </p>
      {games.length > 0 ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>
      ) : (
        <Card>
          <CardContent>{emptyLabel}</CardContent>
        </Card>
      )}
    </>
  );
}
