import Link from "next/link";
import { Diamond } from "@/components/diamond";
import { PlayerLink } from "@/components/player-link";
import { Pop } from "@/components/pop";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/dates";
import { gamePath } from "@/lib/routes";
import { gameTitle, type Game, type GameSide } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

export function Probable({ side, season }: { side: GameSide; season: number }) {
  if (!side.probable) return "TBD";
  return (
    <PlayerLink playerId={side.probable.id} role="pitching" season={season} className="relative z-10">
      {side.probable.name}
    </PlayerLink>
  );
}

function TeamRow({
  side,
  season,
  dimmed,
  showProbable,
}: {
  side: GameSide;
  season: number;
  dimmed: boolean;
  showProbable: boolean;
}) {
  const { record } = side.team;

  return (
    <div className={cn("flex items-center gap-3", dimmed && "opacity-60")}>
      <span className="flex h-9 w-12 items-center justify-center rounded-base border-2 border-border bg-background text-sm font-heading">
        {side.team.abbreviation}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-heading">{side.team.name}</span>
        {(record || showProbable) && (
          <span className="truncate text-xs opacity-70">
            {record}
            {record && showProbable && " · "}
            {showProbable && <Probable side={side} season={season} />}
          </span>
        )}
      </div>
      {side.score !== undefined && (
        <Pop value={side.score} className="text-2xl font-heading tabular-nums">{side.score}</Pop>
      )}
    </div>
  );
}

export function GameCard({ game }: { game: Game }) {
  const { away, home, status } = game;
  const isFinal = status.state === "final";
  const isScheduled = status.state === "scheduled";

  return (
    <Card
      size="sm"
      className={cn(
        "relative h-full transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
        status.state === "live" && "shadow-live",
      )}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge game={game} />
            {status.state === "live" && status.situation && <Diamond situation={status.situation} />}
            {game.doubleHeader && <Badge variant="neutral">Game {game.gameNumber}</Badge>}
            {game.postseason && <Badge variant="neutral">{game.postseason}</Badge>}
          </div>
          <span className="truncate text-xs opacity-70">{game.venue}</span>
        </div>
        <div className="flex flex-col gap-3">
          <TeamRow
            side={away}
            season={game.season}
            dimmed={isFinal && (away.score ?? 0) < (home.score ?? 0)}
            showProbable={isScheduled}
          />
          <TeamRow
            side={home}
            season={game.season}
            dimmed={isFinal && (home.score ?? 0) < (away.score ?? 0)}
            showProbable={isScheduled}
          />
        </div>
        {game.makeupOf && (
          <span className="text-xs opacity-70">Makeup of {formatShortDate(game.makeupOf)}</span>
        )}
      </CardContent>
      <Link href={gamePath(game.gamePk)} aria-label={gameTitle(game)} className="absolute inset-0 rounded-base" />
    </Card>
  );
}

function TeamRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-9 w-12" />
      <Skeleton className="h-5 flex-1" />
    </div>
  );
}

export function GameCardSkeleton() {
  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-6 w-20" />
        <div className="flex flex-col gap-3">
          <TeamRowSkeleton />
          <TeamRowSkeleton />
        </div>
      </CardContent>
    </Card>
  );
}
