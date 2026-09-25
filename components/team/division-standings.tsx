import { TeamLink } from "@/components/team/team-link";
import { Card, CardContent } from "@/components/ui/card";
import type { StandingsRow } from "@/lib/team-summary";
import { cn } from "@/lib/utils";

const cell = "px-2 py-1.5 text-right tabular-nums";

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
      <CardContent className="flex flex-col gap-3 overflow-x-auto">
        <h2 className="text-lg">{title}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs opacity-70">
              <th scope="col" className="px-2 py-1.5 text-left">Team</th>
              <th scope="col" className={cell}>W</th>
              <th scope="col" className={cell}>L</th>
              <th scope="col" className={cell}>Pct</th>
              <th scope="col" className={cell}>GB</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.team.id}
                className={cn("border-t-2 border-border", row.team.id === teamId && "bg-main/20")}
              >
                <th scope="row" className="px-2 py-1.5 text-left font-heading">
                  <TeamLink teamId={row.team.id}>{row.team.name}</TeamLink>
                </th>
                <td className={cell}>{row.wins}</td>
                <td className={cell}>{row.losses}</td>
                <td className={cell}>{formatPct(row.pct)}</td>
                <td className={cell}>{formatGamesBack(row.gamesBack)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
