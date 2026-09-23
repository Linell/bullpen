import { GameCard } from "@/components/game-card";
import { Card, CardContent } from "@/components/ui/card";
import type { Game } from "@/lib/scoreboard";

export function Scoreboard({
  emptyLabel,
  games,
}: {
  emptyLabel: string;
  games: Game[];
}) {
  return (
    <>
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
