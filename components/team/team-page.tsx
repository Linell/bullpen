import "server-only";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GameCardSkeleton } from "@/components/game-card";
import { SeasonSwitcher } from "@/components/season-switcher";
import { DivisionStandings } from "@/components/team/division-standings";
import { TeamHeader, TeamHeaderSkeleton } from "@/components/team/team-header";
import { TeamSchedule } from "@/components/team/team-schedule";
import { TeamStatsSection } from "@/components/team/team-stats-section";
import { TeamTrendsSection } from "@/components/team/team-trends-section";
import { CardSkeleton } from "@/components/ui/skeleton";
import { teamPath } from "@/lib/routes";
import { SEASON_RE, TEAM_ID_RE } from "@/lib/team-id";
import { getTeamStats } from "@/lib/stats/team";
import { getTeamSeasons, getTeamSummary } from "@/lib/team-summary";
import { getTeamTrends } from "@/lib/team-trends";

export type TeamSeason = {
  teamId: number;
  seasons: number[];
  season: number;
  isCurrentSeason: boolean;
};

export async function loadTeamSeason(teamIdParam: string, seasonParam?: string): Promise<TeamSeason> {
  if (!TEAM_ID_RE.test(teamIdParam)) notFound();
  const teamId = Number(teamIdParam);

  const seasons = await getTeamSeasons(teamId);
  const [currentSeason] = seasons;
  if (currentSeason === undefined) notFound();

  const season = seasonParam === undefined ? currentSeason : Number(seasonParam);
  if (seasonParam !== undefined && (!SEASON_RE.test(seasonParam) || !seasons.includes(season))) {
    notFound();
  }

  return { teamId, seasons, season, isCurrentSeason: season === currentSeason };
}

async function loadTeamSummary({ teamId, season }: TeamSeason) {
  const summary = await getTeamSummary(teamId, season);
  if (!summary) notFound();
  return summary;
}

export async function teamTitle(team: TeamSeason) {
  const { name } = (await loadTeamSummary(team)).team;
  return team.isCurrentSeason ? name : `${name} ${team.season}`;
}

export function TeamPage({ team }: { team: Promise<TeamSeason> }) {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<TeamFallback />}>
        <TeamContent team={team} />
      </Suspense>
      <Suspense fallback={<CardSkeleton className="h-64" />}>
        <TeamStats team={team} />
      </Suspense>
      <Suspense fallback={<CardSkeleton className="h-64" />}>
        <TeamTrends team={team} />
      </Suspense>
    </main>
  );
}

async function TeamContent({ team }: { team: Promise<TeamSeason> }) {
  const resolved = await team;
  const { teamId, seasons, season } = resolved;
  const summary = await loadTeamSummary(resolved);
  const [currentSeason] = seasons;

  return (
    <>
      <TeamHeader summary={summary} />
      {seasons.length > 1 && (
        <SeasonSwitcher
          seasons={seasons}
          season={season}
          href={(s) => teamPath(teamId, s === currentSeason ? undefined : s)}
        />
      )}
      <TeamSchedule recent={summary.recentGames} upcoming={summary.upcomingGames} />
      <DivisionStandings
        title={summary.team.division ?? "Division"}
        teamId={teamId}
        standings={summary.standings}
      />
    </>
  );
}

async function TeamStats({ team }: { team: Promise<TeamSeason> }) {
  const { teamId, season, isCurrentSeason } = await team;
  const stats = await getTeamStats(teamId, season);
  return <TeamStatsSection stats={stats} season={isCurrentSeason ? undefined : season} />;
}

async function TeamTrends({ team }: { team: Promise<TeamSeason> }) {
  const { teamId, season, isCurrentSeason } = await team;
  const trends = await getTeamTrends(teamId, season, { isCurrentSeason });
  return <TeamTrendsSection trends={trends} season={isCurrentSeason ? undefined : season} />;
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
