import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameHeader } from "@/components/game-header";
import { LinescoreTable } from "@/components/linescore-table";
import { PlayByPlay } from "@/components/play-by-play";
import { Card, CardContent } from "@/components/ui/card";
import { getGameDetail } from "@/lib/game-detail";
import { gameTitle } from "@/lib/scoreboard";

const GAME_PK_RE = /^\d{1,9}$/;

async function loadGame({ params }: PageProps<"/games/[gamePk]">) {
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

export default async function GamePage(props: PageProps<"/games/[gamePk]">) {
  const { game, decisions, linescore, halfInnings } = await loadGame(props);
  const { away, home } = game;
  const isLive = game.status.state === "live";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <h1 className="text-4xl">{gameTitle(game)}</h1>
      <GameHeader game={game} decisions={decisions} />
      {linescore && <LinescoreTable linescore={linescore} away={away.team} home={home.team} />}
      {halfInnings.length > 0 ? (
        <PlayByPlay halfInnings={halfInnings} away={away.team} home={home.team} />
      ) : (
        <Card>
          <CardContent>
            {isLive ? "Plays appear here as each plate appearance finishes." : "No play-by-play for this game yet."}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
