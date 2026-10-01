import type { Metadata } from "next";
import { PageMain } from "@/components/page-main";
import { loadStandingsSeason, Standings, standingsTitle } from "@/components/standings";

type StandingsParams = Pick<PageProps<"/standings/[[...season]]">, "params">;

export function generateStaticParams() {
  return [{ season: [] }];
}

async function loadFromParams({ params }: StandingsParams) {
  const { season } = await params;
  return loadStandingsSeason(season);
}

export async function generateMetadata(props: PageProps<"/standings/[[...season]]">): Promise<Metadata> {
  return { title: standingsTitle(await loadFromParams(props)) };
}

export default function StandingsPage({ params }: PageProps<"/standings/[[...season]]">) {
  return (
    <PageMain>
      <h1>Standings</h1>
      <Standings standings={loadFromParams({ params })} />
    </PageMain>
  );
}
