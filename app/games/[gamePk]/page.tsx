import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GameHeader } from "@/components/game-header";
import { Matchup } from "@/components/matchup";
import { LinescoreTable } from "@/components/linescore-table";
import { PlayByPlay } from "@/components/play-by-play";
import { Starters } from "@/components/starters";
import { Card, CardContent } from "@/components/ui/card";
import { getGameDetail } from "@/lib/game-detail";
import { GAME_PK_RE } from "@/lib/game-pk";
import { gameTitle } from "@/lib/scoreboard";

type GameParams = Pick<PageProps<"/games/[gamePk]">, "params">;

async function loadGame({ params }: GameParams) {
  const { gamePk } = await params;
  if (!GAME_PK_RE.test(gamePk)) notFound();

  const detail = await getGameDetail(Number(gamePk));
  if (!detail) notFound();
  return detail;
}

export async function generateMetadata(props: PageProps<"/games/[gamePk]">): Promise<Metadata> {
  const { game } = await loadGame(props);
  return { title: gameTitle(game) };
}

export default function GamePage({ params }: PageProps<"/games/[gamePk]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<GameFallback />}>
        <GameContent params={params} />
      </Suspense>
    </main>
  );
}

async function GameContent({ params }: GameParams) {
  const { game, decisions, linescore, halfInnings, awayForm, homeForm, headToHead, starters } =
    await loadGame({ params });
  const { away, home } = game;
  const isLive = game.status.state === "live";
  const isScheduled = game.status.state === "scheduled";
  const hasStarted = isLive || game.status.state === "final";

  const matchup = (
    <Matchup
      away={away.team}
      home={home.team}
      awayForm={awayForm}
      homeForm={homeForm}
      headToHead={headToHead}
    />
  );

  return (
    <>
      <h1 className="sr-only">{gameTitle(game)}</h1>
      <GameHeader game={game} decisions={decisions} />
      {isScheduled && (
        <Starters title="Probable starters" away={away.team} home={home.team} starters={starters} />
      )}
      {!hasStarted && matchup}
      {linescore && <LinescoreTable linescore={linescore} away={away.team} home={home.team} />}
      {hasStarted && (
        <Starters title="Starters" away={away.team} home={home.team} starters={starters} />
      )}
      {halfInnings.length > 0 ? (
        <PlayByPlay halfInnings={halfInnings} away={away.team} home={home.team} />
      ) : hasStarted ? (
        <Card>
          <CardContent>
            {isLive
              ? "Plays appear here as each plate appearance finishes."
              : "No play-by-play for this game yet."}
          </CardContent>
        </Card>
      ) : null}
      {hasStarted && matchup}
    </>
  );
}

function GameFallback() {
  return (
    <Card>
      <CardContent>Loading game…</CardContent>
    </Card>
  );
}
