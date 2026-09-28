import type { ReactNode } from "react";
import { RoleTabs } from "@/components/player/role-tabs";
import { TeamLink } from "@/components/team/team-link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ageOn } from "@/lib/dates";
import type { PlayerSummary } from "@/lib/stats/player";

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs opacity-70">{label}</dt>
      <dd className="font-heading tabular-nums">{value}</dd>
    </div>
  );
}

export function PlayerHeader({
  summary,
  teamSeason,
  today,
}: {
  summary: PlayerSummary;
  teamSeason?: number;
  today: string;
}) {
  const { playerId, fullName, latest, batSide, pitchHand, birthDate, height, weight } = summary;
  const size = [height, weight && `${weight} lb`].filter(Boolean).join(" ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-3xl sm:text-4xl">{fullName}</h1>
            {latest && (
              <p className="flex flex-wrap gap-x-2 text-sm opacity-70">
                {latest.jerseyNumber && <span>#{latest.jerseyNumber}</span>}
                {latest.position && <span>{latest.position}</span>}
                <TeamLink teamId={latest.teamId} season={teamSeason}>
                  {latest.teamName ?? "Team"}
                </TeamLink>
              </p>
            )}
          </div>
          <RoleTabs
            playerId={playerId}
            seasons={{ hitting: summary.battingSeasons, pitching: summary.pitchingSeasons }}
          />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-border pt-3 text-sm">
          <Fact label="B/T" value={`${batSide ?? "—"}/${pitchHand ?? "—"}`} />
          {birthDate && <Fact label="Age" value={ageOn(birthDate, today)} />}
          {size && <Fact label="Ht/Wt" value={size} />}
        </dl>
      </CardContent>
    </Card>
  );
}

export function PlayerHeaderSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-6 border-t-2 border-border pt-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
