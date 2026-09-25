import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RunDiffChart } from "@/components/team/run-diff-chart";
import { formatPercent } from "@/lib/format";
import type { WinLoss } from "@/lib/team-summary";
import type { AbsChallenges, InningRuns, RelieverWorkload, SituationalRecords, TeamTrends } from "@/lib/team-trends";
import { cn } from "@/lib/utils";

const cell = "h-auto px-2 py-1.5 text-center tabular-nums";
const rowHeader = "sticky left-0 h-auto bg-background px-2 py-1.5";

function record({ wins, losses }: WinLoss) {
  return `${wins}-${losses}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-base border-2 border-border bg-background px-3 py-2">
      <dt className="text-xs opacity-70">{label}</dt>
      <dd className="font-heading text-lg tabular-nums">{value}</dd>
    </div>
  );
}

function SituationalGrid({ situational }: { situational: SituationalRecords }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">Situational</h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="One-run games" value={record(situational.oneRun)} />
          <Stat label="Extra innings" value={record(situational.extraInnings)} />
          <Stat label="Blowouts (5+)" value={record(situational.blowouts)} />
          <Stat label="Scoring first" value={record(situational.scoringFirst)} />
          <Stat label="Comeback wins" value={situational.comebackWins} />
          <Stat label="Blown leads" value={situational.blownLeads} />
        </dl>
      </CardContent>
    </Card>
  );
}

function InningRunsTable({ innings }: { innings: InningRuns[] }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">Runs by inning</h2>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead scope="col" className={rowHeader}>
                <span className="sr-only">Runs</span>
              </TableHead>
              {innings.map(({ inning }) => (
                <TableHead key={inning} scope="col" className={cell}>
                  {inning === "extras" ? <Abbr term="X" /> : inning}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableHead scope="row" className={rowHeader}>
                Scored
              </TableHead>
              {innings.map(({ inning, scored, allowed }) => (
                <TableCell key={inning} className={cn(cell, scored > allowed && "font-heading")}>
                  {scored}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableHead scope="row" className={rowHeader}>
                Allowed
              </TableHead>
              {innings.map(({ inning, scored, allowed }) => (
                <TableCell key={inning} className={cn(cell, allowed > scored && "font-heading")}>
                  {allowed}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AbsChallengesCard({ abs }: { abs: AbsChallenges }) {
  const opponentRate = abs.opponentChallenges > 0 ? abs.opponentOverturned / abs.opponentChallenges : null;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">
          <Abbr term="ABS" /> challenges
        </h2>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead scope="col" className={rowHeader}>
                <span className="sr-only">Side</span>
              </TableHead>
              <TableHead scope="col" className={cell}>Challenges</TableHead>
              <TableHead scope="col" className={cell}>Overturned</TableHead>
              <TableHead scope="col" className={cell}>Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableHead scope="row" className={rowHeader}>
                Team
              </TableHead>
              <TableCell className={cell}>{abs.challenges}</TableCell>
              <TableCell className={cell}>{abs.overturned}</TableCell>
              <TableCell className={cell}>{formatPercent(abs.overturnRate ?? null)}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead scope="row" className={rowHeader}>
                Opponents
              </TableHead>
              <TableCell className={cell}>{abs.opponentChallenges}</TableCell>
              <TableCell className={cell}>{abs.opponentOverturned}</TableCell>
              <TableCell className={cell}>{formatPercent(opponentRate)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BullpenWorkloadTable({ relievers }: { relievers: RelieverWorkload[] }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">Bullpen workload</h2>
        {relievers.length === 0 ? (
          <p className="text-sm opacity-70">No relief appearances in the last week.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead scope="col" className={rowHeader}>
                  Pitcher
                </TableHead>
                <TableHead scope="col" className={cell}>Pitches, 3 days</TableHead>
                <TableHead scope="col" className={cell}>Pitches, 7 days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relievers.map((r) => (
                <TableRow key={r.pitcherId}>
                  <TableHead scope="row" className={rowHeader}>
                    {r.name}
                  </TableHead>
                  <TableCell className={cell}>{r.last3Days}</TableCell>
                  <TableCell className={cell}>{r.last7Days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamTrendsSection({ trends }: { trends: TeamTrends }) {
  return (
    <section className="flex flex-col gap-4" aria-label="Team trends">
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg">Run differential</h2>
          <RunDiffChart points={trends.runDiffByGame} />
        </CardContent>
      </Card>
      <SituationalGrid situational={trends.situational} />
      <div className="grid gap-4 lg:grid-cols-2">
        <InningRunsTable innings={trends.runsByInning} />
        <AbsChallengesCard abs={trends.absChallenges} />
      </div>
      {trends.bullpenWorkload && <BullpenWorkloadTable relievers={trends.bullpenWorkload} />}
    </section>
  );
}
