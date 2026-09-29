import Link from "next/link";
import type { LivePlay } from "@/lib/live-game";
import { halfInningLabel } from "@/lib/play-by-play";
import { gamePath } from "@/lib/routes";
import type { Game } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

export type TickerPlay = LivePlay & { game: Game };

const SECONDS_PER_PLAY = 8;

function TickerItem({ play, hidden }: { play: TickerPlay; hidden?: boolean }) {
  const { game } = play;
  return (
    <Link
      href={gamePath(game.gamePk)}
      tabIndex={hidden ? -1 : undefined}
      className="mx-4 inline-flex items-baseline gap-2 text-sm hover:underline"
    >
      <span className={cn("font-heading tabular-nums", play.isScoringPlay && "rounded-base bg-foreground px-1.5 text-secondary-background")}>
        {game.away.team.abbreviation} {play.awayScore}, {game.home.team.abbreviation} {play.homeScore}
      </span>
      <span className="opacity-70">{halfInningLabel(play.inning, play.half)}</span>
      <span>{play.description}</span>
    </Link>
  );
}

export function PlaysTicker({ plays }: { plays: TickerPlay[] }) {
  if (plays.length === 0) return null;

  const items = (hidden?: boolean) =>
    plays.map((play) => (
      <TickerItem key={`${play.game.gamePk}-${play.atBatIndex}`} play={play} hidden={hidden} />
    ));
  const duration = { animationDuration: `${plays.length * SECONDS_PER_PLAY}s` };

  return (
    <section
      aria-label="Latest plays"
      className="group relative flex overflow-x-hidden rounded-base border-2 border-border bg-secondary-background py-2 shadow-shadow motion-reduce:overflow-x-auto"
    >
      <div className="animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:animate-none" style={duration}>
        {items()}
      </div>
      <div
        aria-hidden
        className="absolute top-2 animate-marquee2 whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:hidden"
        style={duration}
      >
        {items(true)}
      </div>
    </section>
  );
}
