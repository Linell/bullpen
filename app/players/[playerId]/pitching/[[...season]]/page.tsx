import type { Metadata } from "next";
import { loadPlayerSeason, playerTitle } from "@/components/player/load-player";
import { PlayerSeasonPage } from "@/components/player/player-season-page";

type PitchingParams = Pick<PageProps<"/players/[playerId]/pitching/[[...season]]">, "params">;

async function loadFromParams({ params }: PitchingParams) {
  const { playerId, season } = await params;
  return loadPlayerSeason(playerId, "pitching", season);
}

export async function generateMetadata(
  props: PageProps<"/players/[playerId]/pitching/[[...season]]">,
): Promise<Metadata> {
  return { title: playerTitle(await loadFromParams(props)) };
}

export default function PlayerPitchingPage({ params }: PageProps<"/players/[playerId]/pitching/[[...season]]">) {
  return <PlayerSeasonPage player={loadFromParams({ params })} />;
}
