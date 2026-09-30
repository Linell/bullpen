import type { Metadata } from "next";
import { loadTeamSeason, TeamPage, teamTitle } from "@/components/team/team-page";

type TeamParams = Pick<PageProps<"/teams/[teamId]">, "params">;

async function loadFromParams({ params }: TeamParams) {
  const { teamId } = await params;
  return loadTeamSeason(teamId);
}

export async function generateMetadata(props: PageProps<"/teams/[teamId]">): Promise<Metadata> {
  return { title: await teamTitle(await loadFromParams(props)) };
}

export default function CurrentSeasonTeamPage({ params }: PageProps<"/teams/[teamId]">) {
  return <TeamPage team={loadFromParams({ params })} />;
}
