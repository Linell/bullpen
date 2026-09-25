import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Linescore, LinescoreLine } from "@/lib/linescore";
import type { Team } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

const cell = "h-auto px-2 py-1.5 text-center tabular-nums";
const teamCell = "sticky left-0 h-auto bg-background px-2 py-1.5";

function LineRow({ team, line }: { team: Team; line: LinescoreLine }) {
  return (
    <TableRow>
      <TableHead scope="row" className={teamCell}>
        {team.abbreviation}
      </TableHead>
      {line.innings.map((runs, i) => (
        <TableCell key={i} className={cell}>
          {runs}
        </TableCell>
      ))}
      <TableCell className={cn(cell, "border-l-2 border-border font-heading")}>{line.runs}</TableCell>
      <TableCell className={cell}>{line.hits}</TableCell>
      <TableCell className={cell}>{line.errors}</TableCell>
    </TableRow>
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
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead scope="col" className={teamCell}>
                <span className="sr-only">Team</span>
              </TableHead>
              {linescore.innings.map((inning) => (
                <TableHead key={inning} scope="col" className={cell}>
                  {inning}
                </TableHead>
              ))}
              <TableHead scope="col" className={cn(cell, "border-l-2 border-border")}>
                <Abbr term="R" />
              </TableHead>
              <TableHead scope="col" className={cell}>
                <Abbr term="H" />
              </TableHead>
              <TableHead scope="col" className={cell}>
                <Abbr term="E" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <LineRow team={away} line={linescore.away} />
            <LineRow team={home} line={linescore.home} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
