import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { RunDiffChart } from "@/components/team/run-diff-chart";
import { formatPercent } from "@/lib/format";
import type { WinLoss } from "@/lib/team-summary";
import type { AbsChallenges, InningRuns, RelieverWorkload, SituationalRecords, TeamTrends } from "@/lib/team-trends";
import { cn } from "@/lib/utils";

const cell = "px-2 py-1.5 text-center tabular-nums";
const rowHeader = "sticky left-0 bg-secondary-background px-2 py-1.5 text-left font-heading";

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs opacity-70">
                <th scope="col" className={rowHeader}>
                  <span className="sr-only">Runs</span>
                </th>
                {innings.map(({ inning }) => (
                  <th key={inning} scope="col" className={cell}>
                    {inning === "extras" ? <Abbr term="X" /> : inning}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t-2 border-border">
                <th scope="row" className={rowHeader}>
                  Scored
                </th>
                {innings.map(({ inning, scored, allowed }) => (
                  <td key={inning} className={cn(cell, scored > allowed && "font-heading")}>
                    {scored}
                  </td>
                ))}
              </tr>
              <tr className="border-t-2 border-border">
                <th scope="row" className={rowHeader}>
                  Allowed
                </th>
                {innings.map(({ inning, scored, allowed }) => (
                  <td key={inning} className={cn(cell, allowed > scored && "font-heading")}>
                    {allowed}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs opacity-70">
              <th scope="col" className={rowHeader}>
                <span className="sr-only">Side</span>
              </th>
              <th scope="col" className={cell}>Challenges</th>
              <th scope="col" className={cell}>Overturned</th>
              <th scope="col" className={cell}>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t-2 border-border">
              <th scope="row" className={rowHeader}>
                Team
              </th>
              <td className={cell}>{abs.challenges}</td>
              <td className={cell}>{abs.overturned}</td>
              <td className={cell}>{formatPercent(abs.overturnRate ?? null)}</td>
            </tr>
            <tr className="border-t-2 border-border">
              <th scope="row" className={rowHeader}>
                Opponents
              </th>
              <td className={cell}>{abs.opponentChallenges}</td>
              <td className={cell}>{abs.opponentOverturned}</td>
              <td className={cell}>{formatPercent(opponentRate)}</td>
            </tr>
          </tbody>
        </table>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs opacity-70">
                <th scope="col" className={rowHeader}>
                  Pitcher
                </th>
                <th scope="col" className={cell}>Pitches, 3 days</th>
                <th scope="col" className={cell}>Pitches, 7 days</th>
              </tr>
            </thead>
            <tbody>
              {relievers.map((r) => (
                <tr key={r.pitcherId} className="border-t-2 border-border">
                  <th scope="row" className={rowHeader}>
                    {r.name}
                  </th>
                  <td className={cell}>{r.last3Days}</td>
                  <td className={cell}>{r.last7Days}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
