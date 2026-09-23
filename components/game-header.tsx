import { Diamond } from "@/components/diamond";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatOfficialDate } from "@/lib/dates";
import type { Decisions } from "@/lib/game-detail";
import type { Game, GameSide } from "@/lib/scoreboard";

function TeamScore({ side }: { side: GameSide }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <span className="text-4xl font-heading tabular-nums">{side.score ?? "–"}</span>
      <span className="truncate font-heading">{side.team.name}</span>
    </div>
  );
}

function DecisionsLine({ decisions }: { decisions: Decisions }) {
  const entries: [string, string | undefined][] = [
    ["W", decisions.winner],
    ["L", decisions.loser],
    ["S", decisions.save],
  ];

  return (
    <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {entries.map(
        ([label, name]) =>
          name && (
            <span key={label}>
              <span className="font-heading">{label}:</span> {name}
            </span>
          ),
      )}
    </p>
  );
}

export function GameHeader({ game, decisions }: { game: Game; decisions?: Decisions }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <StatusBadge game={game} />
          {game.status.state === "live" && game.status.situation && (
            <Diamond situation={game.status.situation} size="lg" />
          )}
        </div>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamScore side={game.away} />
          <span className="text-xl font-heading opacity-70">@</span>
          <TeamScore side={game.home} />
        </div>
        <p className="text-center text-sm opacity-70">
          {[formatOfficialDate(game.officialDate), game.venue].filter(Boolean).join(" · ")}
        </p>
        {decisions && <DecisionsLine decisions={decisions} />}
      </CardContent>
    </Card>
  );
}
