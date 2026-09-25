import "server-only";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { GameCardSkeleton } from "@/components/game-card";
import { DivisionStandings } from "@/components/team/division-standings";
import { SeasonPicker } from "@/components/team/season-picker";
import { TeamHeader, TeamHeaderSkeleton } from "@/components/team/team-header";
import { teamPath } from "@/components/team/team-link";
import { TeamSchedule } from "@/components/team/team-schedule";
import { TeamStatsSection } from "@/components/team/team-stats-section";
import { TeamTrendsSection } from "@/components/team/team-trends-section";
import { CardSkeleton } from "@/components/ui/skeleton";
import { SEASON_RE, TEAM_ID_RE } from "@/lib/team-id";
import { getTeamStats } from "@/lib/team-stats";
import { getTeamSeasons, getTeamSummary, type TeamSummary } from "@/lib/team-summary";
import { getTeamTrends } from "@/lib/team-trends";

export type LoadedTeam = {
  summary: TeamSummary;
  seasons: number[];
  isCurrentSeason: boolean;
};

export async function loadTeam(teamIdParam: string, seasonParam?: string): Promise<LoadedTeam> {
  if (!TEAM_ID_RE.test(teamIdParam)) notFound();
  const teamId = Number(teamIdParam);

  const seasons = await getTeamSeasons(teamId);
  const [currentSeason] = seasons;
  if (currentSeason === undefined) notFound();

  const season = seasonParam === undefined ? currentSeason : Number(seasonParam);
  if (seasonParam !== undefined && (!SEASON_RE.test(seasonParam) || !seasons.includes(season))) {
    notFound();
  }
  if (seasonParam !== undefined && season === currentSeason) redirect(teamPath(teamId));

  const summary = await getTeamSummary(teamId, season);
  if (!summary) notFound();
  return { summary, seasons, isCurrentSeason: season === currentSeason };
}

export function teamTitle({ summary, isCurrentSeason }: LoadedTeam) {
  return isCurrentSeason ? summary.team.name : `${summary.team.name} ${summary.season}`;
}

export function TeamPage({ team }: { team: Promise<LoadedTeam> }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<TeamFallback />}>
        <TeamContent team={team} />
      </Suspense>
    </main>
  );
}

async function TeamContent({ team }: { team: Promise<LoadedTeam> }) {
  const { summary, seasons, isCurrentSeason } = await team;
  const { id } = summary.team;
  const { season } = summary;

  return (
    <>
      <TeamHeader summary={summary} />
      {seasons.length > 1 && <SeasonPicker teamId={id} seasons={seasons} season={season} />}
      <TeamSchedule recent={summary.recentGames} upcoming={summary.upcomingGames} />
      <DivisionStandings
        title={summary.team.division ?? "Division"}
        teamId={id}
        standings={summary.standings}
      />
      <Suspense fallback={<CardSkeleton className="h-64" />}>
        <TeamStats teamId={id} season={season} />
      </Suspense>
      <Suspense fallback={<CardSkeleton className="h-64" />}>
        <TeamTrends teamId={id} season={season} isCurrentSeason={isCurrentSeason} />
      </Suspense>
    </>
  );
}

async function TeamStats({ teamId, season }: { teamId: number; season: number }) {
  return <TeamStatsSection stats={await getTeamStats(teamId, season)} />;
}

async function TeamTrends({
  teamId,
  season,
  isCurrentSeason,
}: {
  teamId: number;
  season: number;
  isCurrentSeason: boolean;
}) {
  return <TeamTrendsSection trends={await getTeamTrends(teamId, season, { isCurrentSeason })} />;
}

function TeamFallback() {
  return (
    <>
      <TeamHeaderSkeleton />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
      <CardSkeleton className="h-40" />
    </>
  );
}
