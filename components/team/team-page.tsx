import "server-only";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DivisionStandings } from "@/components/team/division-standings";
import { SeasonPicker } from "@/components/team/season-picker";
import { TeamHeader } from "@/components/team/team-header";
import { teamPath } from "@/components/team/team-link";
import { TeamSchedule } from "@/components/team/team-schedule";
import { TeamStatsSection } from "@/components/team/team-stats-section";
import { TeamTrendsSection } from "@/components/team/team-trends-section";
import { Card, CardContent } from "@/components/ui/card";
import { getTeamStats } from "@/lib/team-stats";
import { getTeamSeasons, getTeamSummary, type TeamSummary } from "@/lib/team-summary";
import { getTeamTrends } from "@/lib/team-trends";

const TEAM_ID_RE = /^\d{1,9}$/;
const SEASON_RE = /^\d{4}$/;

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
      <Suspense fallback={<SectionFallback label="Loading team…" />}>
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
      <Suspense fallback={<SectionFallback label="Loading stats…" />}>
        <TeamStats teamId={id} season={season} />
      </Suspense>
      <Suspense fallback={<SectionFallback label="Loading trends…" />}>
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

function SectionFallback({ label }: { label: string }) {
  return (
    <Card>
      <CardContent>{label}</CardContent>
    </Card>
  );
}
