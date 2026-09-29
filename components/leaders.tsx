import Link from "next/link";
import { PlayerLink } from "@/components/player-link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDecimal } from "@/lib/format";
import { gamePath, leadersPath, type PlayerRole } from "@/lib/routes";
import { fastestPitches, hardestHitBalls, longestHomeRuns, type EventLeader } from "@/lib/stats/leaderboards";

function GameLink({ leader }: { leader: EventLeader }) {
  return (
    <Link href={gamePath(leader.gamePk)} className="shrink-0 opacity-70 hover:underline">
      {leader.matchup}
    </Link>
  );
}

function LeaderTile({
  label,
  unit,
  digits,
  role,
  leaders,
}: {
  label: string;
  unit: string;
  digits: number;
  role: PlayerRole;
  leaders: EventLeader[];
}) {
  const [top, ...rest] = leaders;

  return (
    <Card size="sm" className="gap-2">
      <CardContent className="flex flex-col gap-2">
        <h3 className="text-sm opacity-70">{label}</h3>
        {top ? (
          <>
            <p className="font-heading text-4xl tabular-nums">
              {formatDecimal(top.value, digits)} <span className="text-base">{unit}</span>
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <PlayerLink playerId={top.player.id} role={role} className="truncate font-heading">
                {top.player.name}
              </PlayerLink>
              <GameLink leader={top} />
            </div>
            {rest.length > 0 && (
              <ol className="flex flex-col gap-1 border-t-2 border-border pt-2 text-sm">
                {rest.map((leader, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="opacity-70">{i + 2}</span>
                    <PlayerLink playerId={leader.player.id} role={role} className="min-w-0 flex-1 truncate">
                      {leader.player.name}
                    </PlayerLink>
                    <GameLink leader={leader} />
                    <span className="w-16 shrink-0 text-right tabular-nums">
                      {formatDecimal(leader.value, digits)} {unit}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <p className="opacity-70">None yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export async function Leaders({ date }: { date: string }) {
  const range = { from: date, to: date, limit: 3 };
  const [homeRuns, pitches, battedBalls] = await Promise.all([
    longestHomeRuns(range),
    fastestPitches(range),
    hardestHitBalls(range),
  ]);
  const isEmpty = homeRuns.length === 0 && pitches.length === 0 && battedBalls.length === 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl">
        <Link href={leadersPath()} className="hover:underline">
          Today&apos;s leaders
        </Link>
      </h2>
      {isEmpty ? (
        <Card size="sm">
          <CardContent className="opacity-70">Leaders show up here once today&apos;s first pitch is thrown.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
          <LeaderTile label="Longest home run" unit="ft" digits={0} role="hitting" leaders={homeRuns} />
          <LeaderTile label="Fastest pitch" unit="mph" digits={1} role="pitching" leaders={pitches} />
          <LeaderTile label="Hardest-hit ball" unit="mph" digits={1} role="hitting" leaders={battedBalls} />
        </div>
      )}
    </section>
  );
}

export function LeadersSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </section>
  );
}
