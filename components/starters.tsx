import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import type { Starter } from "@/lib/game-detail";
import type { Team } from "@/lib/scoreboard";

function StarterRow({ team, starter }: { team: Team; starter: Starter }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 font-heading">{team.abbreviation}</span>
      {starter.name ? (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">
            {starter.name}
            {starter.hand && (
              <span className="opacity-70">
                {" "}
                · <Abbr term={starter.hand === "L" ? "LHP" : "RHP"} />
              </span>
            )}
          </span>
          <span className="text-sm tabular-nums opacity-70">
            {starter.wins}–{starter.losses} · {starter.starts} <Abbr term="GS" /> · {starter.strikeouts}{" "}
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
  starters,
}: {
  title: string;
  away: Team;
  home: Team;
  starters: { away: Starter; home: Starter };
}) {
  if (!starters.away.name && !starters.home.name) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">{title}</h2>
        <StarterRow team={away} starter={starters.away} />
        <StarterRow team={home} starter={starters.home} />
      </CardContent>
    </Card>
  );
}
