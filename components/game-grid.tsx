import { GameCard } from "@/components/game-card";
import type { Game } from "@/lib/scoreboard";

export function GameGrid({ games }: { games: Game[] }) {
  return (
    <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </section>
  );
}
