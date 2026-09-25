import type { Metadata } from "next";
import { loadTeam, TeamPage, teamTitle } from "@/components/team/team-page";

type TeamSeasonParams = Pick<PageProps<"/teams/[teamId]/[season]">, "params">;

async function loadFromParams({ params }: TeamSeasonParams) {
  const { teamId, season } = await params;
  return loadTeam(teamId, season);
}

export async function generateMetadata(
  props: PageProps<"/teams/[teamId]/[season]">,
): Promise<Metadata> {
  return { title: teamTitle(await loadFromParams(props)) };
}

export default function TeamSeasonPage({ params }: PageProps<"/teams/[teamId]/[season]">) {
  return <TeamPage team={loadFromParams({ params })} />;
}
