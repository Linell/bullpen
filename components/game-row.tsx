import Link from "next/link";
import { Probable } from "@/components/game-card";
import { TeamLink } from "@/components/team/team-link";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { gamePath } from "@/lib/routes";
import { gameTitle, seriesGameLabel, type Game, type GameSide } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

function Side({ side, season, dimmed }: { side: GameSide; season: number; dimmed: boolean }) {
  return (
    <span className={cn("flex items-baseline gap-1.5", dimmed && "opacity-60")}>
      <TeamLink teamId={side.team.id} season={season} className="relative z-10">
        {side.team.abbreviation}
      </TeamLink>
      {side.score !== undefined && <span className="tabular-nums">{side.score}</span>}
    </span>
  );
}

export function GameRow({ game }: { game: Game }) {
  const { away, home, status } = game;
  const isFinal = status.state === "final";

  return (
    <Card className="relative gap-1 px-3 py-2 text-sm transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none">
      <div className="flex items-center gap-3">
        <StatusBadge game={game} />
        <span className="flex shrink-0 items-baseline gap-2 font-heading">
          <Side side={away} season={game.season} dimmed={isFinal && (away.score ?? 0) < (home.score ?? 0)} />
          <span className="font-base opacity-60">@</span>
          <Side side={home} season={game.season} dimmed={isFinal && (home.score ?? 0) < (away.score ?? 0)} />
        </span>
        {game.doubleHeader && <Badge variant="neutral">G{game.gameNumber}</Badge>}
        {game.series && (
          <span className="min-w-0 flex-1 truncate text-right text-xs opacity-70">
            {[seriesGameLabel(game.series), game.series.result].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      {status.state === "scheduled" && (
        <span className="truncate text-xs opacity-70">
          <Probable side={away} season={game.season} /> vs <Probable side={home} season={game.season} />
        </span>
      )}
      <Link
        href={gamePath(game.gamePk)}
        aria-label={gameTitle(game)}
        title={game.venue}
        className="absolute inset-0 rounded-base"
      />
    </Card>
  );
}

export function GameRowSkeleton() {
  return (
    <Card className="flex-row items-center gap-3 px-3 py-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-5 flex-1" />
    </Card>
  );
}
