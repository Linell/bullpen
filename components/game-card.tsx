import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatGameTime } from "@/lib/format";
import type { Game, GameSide } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

function StatusBadge({ game }: { game: Game }) {
  const { status } = game;

  if (status.state === "live") {
    return (
      <Badge className="bg-main text-main-foreground">
        <span className="size-2 animate-pulse rounded-full bg-main-foreground" />
        {[status.note ?? "Live", status.inning].filter(Boolean).join(" · ")}
      </Badge>
    );
  }

  if (status.state === "final") {
    const final = status.innings === 9 ? "Final" : `Final/${status.innings}`;
    return <Badge>{status.note ? `${final} · ${status.note}` : final}</Badge>;
  }

  if (status.state === "postponed") return <Badge variant="neutral">Postponed</Badge>;
  if (status.state === "suspended") return <Badge variant="neutral">Suspended</Badge>;
  if (status.state === "cancelled") return <Badge variant="neutral">Cancelled</Badge>;

  const time = formatGameTime(game.startTime);
  return <Badge variant="neutral">{status.note ? `${status.note} · ${time}` : time}</Badge>;
}

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
    <Card size="sm">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge game={game} />
            {game.postseason && <Badge variant="neutral">{game.postseason}</Badge>}
          </div>
          <span className="truncate text-xs opacity-70">{game.venue}</span>
        </div>
        <div className="flex flex-col gap-3">
          <TeamRow side={away} dimmed={isFinal && (away.score ?? 0) < (home.score ?? 0)} />
          <TeamRow side={home} dimmed={isFinal && (home.score ?? 0) < (away.score ?? 0)} />
        </div>
      </CardContent>
    </Card>
  );
}
