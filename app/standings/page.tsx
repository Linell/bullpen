import type { Metadata } from "next";
import { loadStandingsSeason, StandingsPage, standingsTitle } from "@/components/standings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: standingsTitle(await loadStandingsSeason()) };
}

export default function CurrentStandingsPage() {
  return <StandingsPage seasonParam={Promise.resolve(undefined)} />;
}
