import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BoxScore } from "@/components/box-score";
import { GameHeaderSkeleton } from "@/components/game-header";
import { LiveGameHeader } from "@/components/live-game-header";
import { Matchup } from "@/components/matchup";
import { PlayByPlay } from "@/components/play-by-play";
import { Starters } from "@/components/starters";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getBoxScore, type BoxScore as BoxScoreData } from "@/lib/box-score";
import { getGameDetail } from "@/lib/game-detail";
import { GAME_PK_RE } from "@/lib/game-pk";
import { gameTitle, type Team } from "@/lib/scoreboard";

type GameParams = Pick<PageProps<"/games/[gamePk]">, "params">;

async function gamePkFrom({ params }: GameParams) {
  const { gamePk } = await params;
  if (!GAME_PK_RE.test(gamePk)) notFound();
  return Number(gamePk);
}

async function loadGame(gamePk: number) {
  const detail = await getGameDetail(gamePk);
  if (!detail) notFound();
  return detail;
}

export async function generateMetadata(props: PageProps<"/games/[gamePk]">): Promise<Metadata> {
  const { game } = await loadGame(await gamePkFrom(props));
  return { title: gameTitle(game) };
}

export default function GamePage({ params }: PageProps<"/games/[gamePk]">) {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <Suspense fallback={<GameFallback />}>
        <GameContent params={params} />
      </Suspense>
    </main>
  );
}

async function GameContent({ params }: GameParams) {
  const gamePk = await gamePkFrom({ params });
  // Kick off now to fetch alongside loadGame
  const boxScorePromise = getBoxScore(gamePk);
  const { game, decisions, linescore, halfInnings, awayForm, homeForm, headToHead, starters } =
    await loadGame(gamePk);
  const { away, home } = game;
  const isLive = game.status.state === "live";
  const isScheduled = game.status.state === "scheduled";
  const hasStarted = isLive || game.status.state === "final";
  const lastAtBatIndex = Math.max(-1, ...halfInnings.flatMap((h) => h.plateAppearances.map((pa) => pa.atBatIndex)));

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
      <LiveGameHeader game={game} decisions={decisions} linescore={linescore} lastAtBatIndex={lastAtBatIndex} />
      {(isScheduled || hasStarted) && (
        <Starters
          title={hasStarted ? "Starters" : "Probable starters"}
          away={away.team}
          home={home.team}
          season={game.season}
          starters={starters}
        />
      )}
      {!hasStarted && matchup}
      {hasStarted && (
        <Suspense fallback={<CardSkeleton className="h-64" />}>
          <GameBoxScore away={away.team} home={home.team} season={game.season} boxScore={boxScorePromise} />
        </Suspense>
      )}
      <div className="w-full max-w-3xl empty:hidden">
        {halfInnings.length > 0 ? (
          <PlayByPlay
            halfInnings={halfInnings}
            away={away.team}
            home={home.team}
            season={game.season}
          />
        ) : hasStarted ? (
          <Card>
            <CardContent>
              {isLive
                ? "Plays appear here as each plate appearance finishes."
                : "No play-by-play for this game yet."}
            </CardContent>
          </Card>
        ) : null}
      </div>
      {hasStarted && matchup}
    </>
  );
}

async function GameBoxScore({
  boxScore,
  ...props
}: {
  away: Team;
  home: Team;
  season: number;
  boxScore: Promise<BoxScoreData | undefined>;
}) {
  const data = await boxScore;
  return data && <BoxScore {...props} boxScore={data} />;
}

function GameFallback() {
  return (
    <>
      <GameHeaderSkeleton />
      <CardSkeleton className="h-24" />
      <CardSkeleton className="h-64" />
    </>
  );
}
