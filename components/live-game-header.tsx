"use client";

import { useRealtime } from "inngest/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameHeader } from "@/components/game-header";
import { LinescoreTable } from "@/components/linescore-table";
import { GAME_TOPICS, gameChannel } from "@/inngest/channels";
import { gameToken } from "@/inngest/realtime-tokens";
import type { Decisions } from "@/lib/game-detail";
import { toLinescore, type Linescore } from "@/lib/linescore";
import { patchGame } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";

export function LiveGameHeader({
  game,
  decisions,
  linescore,
}: {
  game: Game;
  decisions?: Decisions;
  linescore?: Linescore;
}) {
  const router = useRouter();
  const { messages } = useRealtime({
    channel: gameChannel({ gamePk: game.gamePk }),
    topics: GAME_TOPICS,
    token: () => gameToken(game.gamePk),
    enabled: !game.completed,
    autoCloseOnTerminal: false,
  });

  const derived = messages.byTopic.derived;
  useEffect(() => {
    if (derived) router.refresh();
  }, [derived, router]);

  const live = messages.byTopic.game?.data;
  const patched = patchGame(game, live);
  const liveLinescore =
    live && patched !== game && live.linescore.length > 0 ? toLinescore(live.linescore, live.completed) : linescore;

  return (
    <>
      <GameHeader game={patched} decisions={decisions} />
      {liveLinescore && <LinescoreTable linescore={liveLinescore} away={game.away.team} home={game.home.team} />}
    </>
  );
}
