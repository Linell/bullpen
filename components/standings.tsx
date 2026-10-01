import { Suspense, useId } from "react";
import { SeasonSwitcher } from "@/components/season-switcher";
import { TeamLink } from "@/components/team/team-link";
import {
  cell,
  formatGamesBack,
  formatPct,
} from "@/components/team/division-standings";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { standingsPath } from "@/lib/routes";
import { resolveSeason } from "@/lib/season";
import {
  getStandings,
  getStandingsSeasons,
  WILD_CARD_SPOTS,
  type LeagueStandings,
  type TeamStanding,
} from "@/lib/standings";
import { cn } from "@/lib/utils";

function formatDiff(runDiff: number) {
  return runDiff > 0 ? `+${runDiff}` : String(runDiff);
}

function StandingsCard({
  title,
  linkSeason,
  teams,
  gamesBack = "GB",
  cutoff,
}: {
  title: string;
  linkSeason?: number;
  teams: TeamStanding[];
  gamesBack?: "GB" | "WCGB";
  cutoff?: number;
}) {
  const columns = ["W", "L", "Pct", gamesBack, "L10", "Strk", "Diff"] as const;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h3>{title}</h3>
        <Table>
          <TableCaption className="sr-only">{title} standings</TableCaption>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead scope="col">Team</TableHead>
              {columns.map((term) => (
                <TableHead key={term} scope="col" className={cell}>
                  <Abbr term={term} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((row, i) => (
              <TableRow key={row.team.id} className={cn(i + 1 === cutoff && i + 1 < teams.length && "border-b-4")}>
                <TableHead scope="row">
                  <TeamLink teamId={row.team.id} season={linkSeason}>{row.team.name}</TeamLink>
                </TableHead>
                <TableCell className={cell}>{row.wins}</TableCell>
                <TableCell className={cell}>{row.losses}</TableCell>
                <TableCell className={cell}>{formatPct(row.pct)}</TableCell>
                <TableCell className={cell}>{formatGamesBack(row.gamesBack)}</TableCell>
                <TableCell className={cell}>
                  {row.last10.wins}-{row.last10.losses}
                </TableCell>
                <TableCell className={cell}>{row.streak ?? "—"}</TableCell>
                <TableCell className={cell}>{formatDiff(row.runDiff)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Leagues({ leagues, linkSeason }: { leagues: LeagueStandings[]; linkSeason?: number }) {
  const idPrefix = useId();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {leagues.map((league, i) => (
        <section key={league.name} aria-labelledby={`${idPrefix}-${i}`} className="flex flex-col gap-6">
          <h2 id={`${idPrefix}-${i}`}>{league.name}</h2>
          {league.divisions.map((division) => (
            <StandingsCard key={division.id} title={division.name} linkSeason={linkSeason} teams={division.teams} />
          ))}
          <StandingsCard
            title="Wild Card"
            linkSeason={linkSeason}
            teams={league.wildCard}
            gamesBack="WCGB"
            cutoff={WILD_CARD_SPOTS}
          />
        </section>
      ))}
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-96 max-w-full" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </>
  );
}

type StandingsSeason = { seasons: number[]; season: number; isCurrentSeason: boolean };

export async function loadStandingsSeason(seasonParam?: string[]): Promise<StandingsSeason> {
  const seasons = await getStandingsSeasons();
  const { season, isCurrentSeason } = resolveSeason(seasons, seasonParam);
  return { seasons, season, isCurrentSeason };
}

export function standingsTitle({ season, isCurrentSeason }: StandingsSeason) {
  return isCurrentSeason ? "Standings" : `${season} Standings`;
}

export function Standings({ standings }: { standings: Promise<StandingsSeason> }) {
  return (
    <Suspense fallback={<StandingsSkeleton />}>
      <StandingsContent standings={standings} />
    </Suspense>
  );
}

async function StandingsContent({ standings }: { standings: Promise<StandingsSeason> }) {
  const { seasons, season, isCurrentSeason } = await standings;
  const [currentSeason] = seasons;
  const leagues = await getStandings(season);

  return (
    <>
      <SeasonSwitcher
        seasons={seasons}
        season={season}
        href={(s) => standingsPath(s === currentSeason ? undefined : s)}
      />
      <Leagues leagues={leagues} linkSeason={isCurrentSeason ? undefined : season} />
    </>
  );
}
