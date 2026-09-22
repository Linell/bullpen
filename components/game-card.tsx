import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatGameTime } from "@/lib/format";
import type { Game, GameSide } from "@/lib/games";
import { cn } from "@/lib/utils";

function StatusBadge({ game }: { game: Game }) {
  const { status } = game;

  if (status.state === "live") {
    return (
      <Badge className="bg-main text-main-foreground">
        <span className="size-2 animate-pulse rounded-full bg-main-foreground" />
        Live · {status.inning}
      </Badge>
    );
  }

  if (status.state === "final") {
    return (
      <Badge>{status.innings === 9 ? "Final" : `Final/${status.innings}`}</Badge>
    );
  }

  return <Badge variant="neutral">{formatGameTime(game.startTime)}</Badge>;
}

function TeamRow({ side, dimmed }: { side: GameSide; dimmed: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", dimmed && "opacity-60")}>
      <span className="flex h-9 w-12 items-center justify-center rounded-base border-2 border-border bg-background text-sm font-heading">
        {side.team.abbreviation}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-heading">{side.team.name}</span>
        <span className="text-xs opacity-70">{side.team.record}</span>
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
  const awayScore = away.score ?? 0;
  const homeScore = home.score ?? 0;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge game={game} />
          <span className="truncate text-xs opacity-70">{game.venue}</span>
        </div>
        <div className="flex flex-col gap-3">
          <TeamRow side={away} dimmed={isFinal && awayScore < homeScore} />
          <TeamRow side={home} dimmed={isFinal && homeScore < awayScore} />
        </div>
      </CardContent>
    </Card>
  );
}
