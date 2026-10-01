import { GameCard } from "@/components/game-card";
import type { Game } from "@/lib/scoreboard";

function ScheduleSection({ title, games }: { title: string; games: Game[] }) {
  if (games.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

export function TeamSchedule({ recent, upcoming }: { recent: Game[]; upcoming: Game[] }) {
  return (
    <>
      <ScheduleSection title="Upcoming" games={upcoming} />
      <ScheduleSection title="Recent" games={recent} />
    </>
  );
}
