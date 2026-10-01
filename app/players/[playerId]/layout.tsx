import { Suspense } from "react";
import { connection } from "next/server";
import { PageMain } from "@/components/page-main";
import { loadPlayer, teamLinkSeason } from "@/components/player/load-player";
import { PlayerHeader, PlayerHeaderSkeleton } from "@/components/player/player-header";
import { todayOfficialDate } from "@/lib/dates";

type PlayerParams = Pick<LayoutProps<"/players/[playerId]">, "params">;

export default function PlayerLayout({ params, children }: LayoutProps<"/players/[playerId]">) {
  return (
    <PageMain>
      <Suspense fallback={<PlayerHeaderSkeleton />}>
        <PlayerHeaderSection params={params} />
      </Suspense>
      {children}
    </PageMain>
  );
}

async function PlayerHeaderSection({ params }: PlayerParams) {
  const { playerId } = await params;
  const summary = await loadPlayer(playerId);
  const linkSeason = await teamLinkSeason(summary);
  await connection();
  return <PlayerHeader summary={summary} teamLinkSeason={linkSeason} today={todayOfficialDate()} />;
}
