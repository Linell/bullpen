import type { ReactNode } from "react";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamSummary, WinLoss } from "@/lib/team-summary";

function formatWinLoss({ wins, losses }: WinLoss) {
  return `${wins}–${losses}`;
}

function formatRunDiff(runDiff: number) {
  return runDiff > 0 ? `+${runDiff}` : String(runDiff);
}

function Stat({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs opacity-70">{label}</dt>
      <dd className="text-lg font-heading tabular-nums">{value}</dd>
    </div>
  );
}

export function TeamHeader({ summary }: { summary: TeamSummary }) {
  const { team, season, record } = summary;
  const affiliation = [team.division ?? team.league, season].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl">{team.name}</h1>
            <p className="text-sm opacity-70">{affiliation}</p>
          </div>
          <span className="text-4xl font-heading tabular-nums">{formatWinLoss(record)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t-2 border-border pt-4 sm:grid-cols-4">
          <Stat label="Run diff" value={formatRunDiff(record.runDiff)} />
          <Stat label={<Abbr term="Pythag" />} value={formatWinLoss(record.pythag)} />
          <Stat label="Streak" value={record.streak ?? "—"} />
          <Stat label="Last 10" value={formatWinLoss(record.last10)} />
        </dl>
      </CardContent>
    </Card>
  );
}

export function TeamHeaderSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-4 border-t-2 border-border pt-4 sm:grid-cols-4">
          {["Run diff", "Pythag", "Streak", "Last 10"].map((label) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-xs opacity-70">{label}</span>
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
