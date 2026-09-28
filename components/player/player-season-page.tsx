import "server-only";
import { Suspense } from "react";
import { HittingSections } from "@/components/player/hitting-sections";
import type { LoadedPlayerSeason } from "@/components/player/load-player";
import { PitchingSections } from "@/components/player/pitching-sections";
import { SeasonSwitcher } from "@/components/season-switcher";
import { CardSkeleton } from "@/components/ui/skeleton";
import { playerPath } from "@/lib/routes";

export function PlayerSeasonPage({ player }: { player: Promise<LoadedPlayerSeason> }) {
  return (
    <Suspense fallback={<PlayerSeasonFallback />}>
      <PlayerSeasonContent player={player} />
    </Suspense>
  );
}

async function PlayerSeasonContent({ player }: { player: Promise<LoadedPlayerSeason> }) {
  const { summary, role, seasons, season } = await player;
  const { playerId } = summary;
  const [latestSeason] = seasons;

  return (
    <>
      {seasons.length > 1 && (
        <SeasonSwitcher
          seasons={seasons}
          season={season}
          href={(s) => playerPath(playerId, { role, season: s === latestSeason ? undefined : s })}
        />
      )}
      {role === "hitting" ? (
        <HittingSections playerId={playerId} season={season} />
      ) : (
        <PitchingSections playerId={playerId} season={season} />
      )}
    </>
  );
}

function PlayerSeasonFallback() {
  return (
    <>
      <CardSkeleton className="h-12" />
      <CardSkeleton className="h-64" />
    </>
  );
}
