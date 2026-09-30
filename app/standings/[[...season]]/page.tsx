import type { Metadata } from "next";
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
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <h1 className="text-3xl">Standings</h1>
      <Standings standings={loadFromParams({ params })} />
    </main>
  );
}
