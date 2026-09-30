import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { SeasonSwitcher } from "@/components/season-switcher";
import { TeamLink } from "@/components/team/team-link";
import {
  cell,
  formatGamesBack,
  formatPct,
  teamCell,
} from "@/components/team/division-standings";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { standingsPath } from "@/lib/routes";
import { getStandings, getStandingsSeasons, type LeagueStandings, type TeamStanding } from "@/lib/standings";
import { SEASON_RE } from "@/lib/team-id";

const COLUMNS = ["W", "L", "Pct", "GB", "L10", "Strk", "Diff"] as const;

function formatDiff(runDiff: number) {
  return runDiff > 0 ? `+${runDiff}` : String(runDiff);
}

function StandingsCard({ title, season, teams }: { title: string; season: number; teams: TeamStanding[] }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h3 className="text-lg">{title}</h3>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead scope="col" className={teamCell}>Team</TableHead>
              {COLUMNS.map((term) => (
                <TableHead key={term} scope="col" className={cell}>
                  <Abbr term={term} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((row) => (
              <TableRow key={row.team.id}>
                <TableHead scope="row" className={teamCell}>
                  <TeamLink teamId={row.team.id} season={season}>{row.team.name}</TeamLink>
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

function Leagues({ leagues, season }: { leagues: LeagueStandings[]; season: number }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {leagues.map((league) => (
        <section key={league.name} className="flex flex-col gap-6">
          <h2 className="text-2xl">{league.name}</h2>
          {league.divisions.map((division) => (
            <StandingsCard key={division.id} title={division.name} season={season} teams={division.teams} />
          ))}
          <StandingsCard title="Wild Card" season={season} teams={league.wildCard} />
        </section>
      ))}
    </div>
  );
}

export function StandingsSkeleton() {
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

export async function loadStandingsSeason(seasonParam?: string) {
  const seasons = await getStandingsSeasons();
  const [currentSeason] = seasons;
  if (currentSeason === undefined) notFound();

  const season = seasonParam === undefined ? currentSeason : Number(seasonParam);
  if (seasonParam !== undefined && (!SEASON_RE.test(seasonParam) || !seasons.includes(season))) {
    notFound();
  }
  if (seasonParam !== undefined && season === currentSeason) redirect(standingsPath());
  return { seasons, season, isCurrentSeason: season === currentSeason };
}

export function standingsTitle({ season, isCurrentSeason }: { season: number; isCurrentSeason: boolean }) {
  return isCurrentSeason ? "Standings" : `${season} Standings`;
}

export function StandingsPage({ seasonParam }: { seasonParam: Promise<string | undefined> }) {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <h1 className="text-3xl">Standings</h1>
      <Suspense fallback={<StandingsSkeleton />}>
        <StandingsContent seasonParam={seasonParam} />
      </Suspense>
    </main>
  );
}

async function StandingsContent({ seasonParam }: { seasonParam: Promise<string | undefined> }) {
  const { seasons, season } = await loadStandingsSeason(await seasonParam);
  const [currentSeason] = seasons;
  const leagues = await getStandings(season);

  return (
    <>
      <SeasonSwitcher
        seasons={seasons}
        season={season}
        href={(s) => standingsPath(s === currentSeason ? undefined : s)}
      />
      <Leagues leagues={leagues} season={season} />
    </>
  );
}
