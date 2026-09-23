import Link from "next/link";
import { Diamond } from "@/components/diamond";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatShortDate } from "@/lib/dates";
import type { Game, GameSide } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

function TeamRow({ side, dimmed }: { side: GameSide; dimmed: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", dimmed && "opacity-60")}>
      <span className="flex h-9 w-12 items-center justify-center rounded-base border-2 border-border bg-background text-sm font-heading">
        {side.team.abbreviation}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-heading">{side.team.name}</span>
        {side.team.record && (
          <span className="text-xs opacity-70">{side.team.record}</span>
        )}
      </div>
      {side.score !== undefined && (
        <span className="text-2xl font-heading tabular-nums">{side.score}</span>
      )}
    </div>
  );
}

export function GameCard({ game }: { game: Game }) {
  const { away, home, status } = game;
  const isFinal = status.state === "final";

  return (
    <Link href={`/games/${game.gamePk}`} className="group rounded-base">
      <Card
        size="sm"
        className={cn(
          "h-full transition-all group-hover:translate-x-boxShadowX group-hover:translate-y-boxShadowY group-hover:shadow-none",
          status.state === "live" && "shadow-live",
        )}
      >
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge game={game} />
              {status.state === "live" && status.situation && (
                <Diamond situation={status.situation} />
              )}
              {game.doubleHeader && (
                <Badge variant="neutral">Game {game.gameNumber}</Badge>
              )}
              {game.postseason && (
                <Badge variant="neutral">{game.postseason}</Badge>
              )}
            </div>
            <span className="truncate text-xs opacity-70">{game.venue}</span>
          </div>
          <div className="flex flex-col gap-3">
            <TeamRow
              side={away}
              dimmed={isFinal && (away.score ?? 0) < (home.score ?? 0)}
            />
            <TeamRow
              side={home}
              dimmed={isFinal && (home.score ?? 0) < (away.score ?? 0)}
            />
          </div>
          {game.makeupOf && (
            <span className="text-xs opacity-70">
              Makeup of {formatShortDate(game.makeupOf)}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
