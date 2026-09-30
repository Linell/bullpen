import type { Metadata } from "next";
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
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <TeamPage team={loadFromParams({ params })} />
    </main>
  );
}
