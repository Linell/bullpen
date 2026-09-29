import type { ReactNode } from "react";
import { GameCard } from "@/components/game-card";
import { GameRow } from "@/components/game-row";
import type { Game } from "@/lib/scoreboard";

function GameSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function GameRows({ title, games }: { title: string; games: Game[] }) {
  if (games.length === 0) return null;

  return (
    <GameSection title={title}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
      </div>
    </GameSection>
  );
}

export function GameGrid({ games }: { games: Game[] }) {
  const live = games.filter((game) => game.status.state === "live");
  const upcoming = games.filter((game) => game.status.state === "scheduled");
  const done = games.filter((game) => game.status.state !== "live" && game.status.state !== "scheduled");

  return (
    <>
      {live.length > 0 && (
        <GameSection title="Live now">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {live.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </GameSection>
      )}
      <GameRows title="Upcoming" games={upcoming} />
      <GameRows title="Final" games={done} />
    </>
  );
}
