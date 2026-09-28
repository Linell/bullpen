import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadPlayer, primaryRole } from "@/components/player/load-player";
import { playerPath } from "@/lib/routes";

type PlayerParams = Pick<PageProps<"/players/[playerId]">, "params">;

export default function PlayerPage({ params }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense>
      <RedirectToPrimaryRole params={params} />
    </Suspense>
  );
}

async function RedirectToPrimaryRole({ params }: PlayerParams) {
  const { playerId } = await params;
  const summary = await loadPlayer(playerId);
  return redirect(playerPath(summary.playerId, { role: primaryRole(summary) }));
}
