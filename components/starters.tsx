import { PlayerLink } from "@/components/player-link";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { formatWinLoss } from "@/lib/format";
import type { Starter } from "@/lib/game-detail";
import type { Team } from "@/lib/scoreboard";

function StarterRow({ team, season, starter }: { team: Team; season: number; starter: Starter }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 font-heading">{team.abbreviation}</span>
      {starter.pitcher ? (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">
            <PlayerLink playerId={starter.pitcher.id} role="pitching" season={season}>
              {starter.pitcher.name}
            </PlayerLink>
            {starter.hand && (
              <span className="opacity-70">
                {" "}
                · <Abbr term={starter.hand === "L" ? "LHP" : "RHP"} />
              </span>
            )}
          </span>
          <span className="text-sm tabular-nums opacity-70">
            {formatWinLoss(starter)} · {starter.starts} <Abbr term="GS" /> · {starter.strikeouts}{" "}
            <Abbr term="K" />
          </span>
        </div>
      ) : (
        <span className="opacity-70">TBD</span>
      )}
    </div>
  );
}

export function Starters({
  title,
  away,
  home,
  season,
  starters,
}: {
  title: string;
  away: Team;
  home: Team;
  season: number;
  starters: { away: Starter; home: Starter };
}) {
  if (!starters.away.pitcher && !starters.home.pitcher) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2>{title}</h2>
        <StarterRow team={away} season={season} starter={starters.away} />
        <StarterRow team={home} season={season} starter={starters.home} />
      </CardContent>
    </Card>
  );
}
