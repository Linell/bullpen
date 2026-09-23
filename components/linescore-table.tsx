import { Card, CardContent } from "@/components/ui/card";
import type { Linescore, LinescoreLine } from "@/lib/linescore";
import type { Team } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

const cell = "px-2 py-1.5 text-center tabular-nums";

function LineRow({ team, line }: { team: Team; line: LinescoreLine }) {
  return (
    <tr className="border-t-2 border-border">
      <th scope="row" className="sticky left-0 bg-secondary-background px-2 py-1.5 text-left font-heading">
        {team.abbreviation}
      </th>
      {line.innings.map((runs, i) => (
        <td key={i} className={cell}>
          {runs}
        </td>
      ))}
      <td className={cn(cell, "border-l-2 border-border font-heading")}>{line.runs}</td>
      <td className={cell}>{line.hits}</td>
      <td className={cell}>{line.errors}</td>
    </tr>
  );
}

export function LinescoreTable({
  linescore,
  away,
  home,
}: {
  linescore: Linescore;
  away: Team;
  home: Team;
}) {
  return (
    <Card size="sm">
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs opacity-70">
              <th scope="col" className="sticky left-0 bg-secondary-background px-2 py-1.5 text-left">
                <span className="sr-only">Team</span>
              </th>
              {linescore.innings.map((inning) => (
                <th key={inning} scope="col" className={cell}>
                  {inning}
                </th>
              ))}
              <th scope="col" className={cn(cell, "border-l-2 border-border")}>R</th>
              <th scope="col" className={cell}>H</th>
              <th scope="col" className={cell}>E</th>
            </tr>
          </thead>
          <tbody>
            <LineRow team={away} line={linescore.away} />
            <LineRow team={home} line={linescore.home} />
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
