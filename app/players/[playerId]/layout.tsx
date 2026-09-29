import { Suspense } from "react";
import { connection } from "next/server";
import { loadPlayer, teamLinkSeason } from "@/components/player/load-player";
import { PlayerHeader, PlayerHeaderSkeleton } from "@/components/player/player-header";
import { todayOfficialDate } from "@/lib/dates";

type PlayerParams = Pick<LayoutProps<"/players/[playerId]">, "params">;

export default function PlayerLayout({ params, children }: LayoutProps<"/players/[playerId]">) {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<PlayerHeaderSkeleton />}>
        <PlayerHeaderSection params={params} />
      </Suspense>
      {children}
    </main>
  );
}

async function PlayerHeaderSection({ params }: PlayerParams) {
  const { playerId } = await params;
  const summary = await loadPlayer(playerId);
  const teamSeason = await teamLinkSeason(summary);
  await connection();
  return <PlayerHeader summary={summary} teamSeason={teamSeason} today={todayOfficialDate()} />;
}
