import type { Metadata } from "next";
import { loadPlayerSeason, playerTitle } from "@/components/player/load-player";
import { PlayerSeasonPage } from "@/components/player/player-season-page";

type HittingParams = Pick<PageProps<"/players/[playerId]/hitting/[[...season]]">, "params">;

async function loadFromParams({ params }: HittingParams) {
  const { playerId, season } = await params;
  return loadPlayerSeason(playerId, "hitting", season);
}

export async function generateMetadata(
  props: PageProps<"/players/[playerId]/hitting/[[...season]]">,
): Promise<Metadata> {
  return { title: playerTitle(await loadFromParams(props)) };
}

export default function PlayerHittingPage({ params }: PageProps<"/players/[playerId]/hitting/[[...season]]">) {
  return <PlayerSeasonPage player={loadFromParams({ params })} />;
}
