import { TeamLink } from "@/components/team/team-link";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StandingsRow } from "@/lib/team-summary";
import { cn } from "@/lib/utils";

const cell = "h-auto px-2 py-1.5 text-right tabular-nums";
const teamCell = "h-auto px-2 py-1.5";

function formatPct(pct: number) {
  return pct.toFixed(3).replace(/^0/, "");
}

function formatGamesBack(gamesBack: number) {
  return gamesBack === 0 ? "—" : String(gamesBack);
}

export function DivisionStandings({
  title,
  teamId,
  standings,
}: {
  title: string;
  teamId: number;
  standings: StandingsRow[];
}) {
  if (standings.length === 0) return null;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">{title}</h2>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead scope="col" className={teamCell}>Team</TableHead>
              <TableHead scope="col" className={cell}>
                <Abbr term="W" />
              </TableHead>
              <TableHead scope="col" className={cell}>
                <Abbr term="L" />
              </TableHead>
              <TableHead scope="col" className={cell}>
                <Abbr term="Pct" />
              </TableHead>
              <TableHead scope="col" className={cell}>
                <Abbr term="GB" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((row) => (
              <TableRow key={row.team.id} data-state={row.team.id === teamId ? "selected" : undefined}>
                <TableHead scope="row" className={cn(teamCell, row.team.id === teamId && "text-main-foreground")}>
                  <TeamLink teamId={row.team.id}>{row.team.name}</TeamLink>
                </TableHead>
                <TableCell className={cell}>{row.wins}</TableCell>
                <TableCell className={cell}>{row.losses}</TableCell>
                <TableCell className={cell}>{formatPct(row.pct)}</TableCell>
                <TableCell className={cell}>{formatGamesBack(row.gamesBack)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
