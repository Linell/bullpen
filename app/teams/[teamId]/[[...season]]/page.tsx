import type { Metadata } from "next";
import { PageMain } from "@/components/page-main";
import { loadTeamSeason, TeamPage, teamTitle } from "@/components/team/team-page";

type TeamParams = Pick<PageProps<"/teams/[teamId]/[[...season]]">, "params">;

async function loadFromParams({ params }: TeamParams) {
  const { teamId, season } = await params;
  return loadTeamSeason(teamId, season);
}

export async function generateMetadata(props: PageProps<"/teams/[teamId]/[[...season]]">): Promise<Metadata> {
  return { title: await teamTitle(await loadFromParams(props)) };
}

export default function TeamSeasonPage({ params }: PageProps<"/teams/[teamId]/[[...season]]">) {
  return (
    <PageMain>
      <TeamPage team={loadFromParams({ params })} />
    </PageMain>
  );
}
