import type { Metadata } from "next";
import { loadStandingsSeason, StandingsPage, standingsTitle } from "@/components/standings";

export async function generateMetadata({ params }: PageProps<"/standings/[season]">): Promise<Metadata> {
  const { season } = await params;
  return { title: standingsTitle(await loadStandingsSeason(season)) };
}

export default function SeasonStandingsPage({ params }: PageProps<"/standings/[season]">) {
  return <StandingsPage seasonParam={params.then(({ season }) => season)} />;
}
