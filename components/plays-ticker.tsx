import Link from "next/link";
import type { LivePlay } from "@/lib/live-game";
import { halfInningLabel } from "@/lib/play-by-play";
import { gamePath } from "@/lib/routes";
import type { Game } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

export type TickerPlay = LivePlay & { game: Game };

export function PlaysTicker({ plays }: { plays: TickerPlay[] }) {
  if (plays.length === 0) return null;

  return (
    <section aria-label="Latest plays" aria-live="polite" className="space-y-1 text-sm text-foreground/60">
      {plays.map((play) => (
        <Link
          key={`${play.game.gamePk}-${play.atBatIndex}`}
          href={gamePath(play.game.gamePk)}
          className="flex items-baseline gap-2 truncate hover:text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-500"
        >
          <span className={cn("shrink-0 tabular-nums", play.isScoringPlay && "font-heading text-foreground")}>
            {play.game.away.team.abbreviation} {play.awayScore}, {play.game.home.team.abbreviation} {play.homeScore}
          </span>
          <span className="shrink-0">{halfInningLabel(play.inning, play.half)}</span>
          <span className="truncate">{play.description}</span>
        </Link>
      ))}
    </section>
  );
}
