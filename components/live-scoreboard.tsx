"use client";

import { useRealtime } from "inngest/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameGrid } from "@/components/game-grid";
import { PlaysTicker, type TickerPlay } from "@/components/plays-ticker";
import { SCOREBOARD_TOPICS, scoreboardChannel } from "@/inngest/channels";
import { scoreboardToken } from "@/inngest/realtime-tokens";
import { patchGame, type LiveGame } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";

const TICKER_PLAYS = 15;

export function LiveScoreboard({ games }: { games: Game[] }) {
  const router = useRouter();
  const { messages } = useRealtime({
    channel: scoreboardChannel,
    topics: SCOREBOARD_TOPICS,
    token: scoreboardToken,
    enabled: games.some((game) => !game.completed),
    autoCloseOnTerminal: false,
    historyLimit: 500,
  });

  const gamesByPk = new Map(games.map((game) => [game.gamePk, game]));

  const derived = messages.byTopic.derived;
  const derivedToday = derived?.data.gamePks.some((gamePk) => gamesByPk.has(gamePk)) ?? false;
  useEffect(() => {
    if (derivedToday) router.refresh();
  }, [derived, derivedToday, router]);

  const liveGames = new Map<number, LiveGame>();
  const plays = new Map<string, TickerPlay>();
  for (const message of messages.all) {
    if (message.kind === "run") continue;
    if (message.topic === "game") liveGames.set(message.data.gamePk, message.data);
    if (message.topic !== "play") continue;
    const game = gamesByPk.get(message.data.gamePk);
    if (!game) continue;
    for (const play of message.data.plays) plays.set(`${game.gamePk}-${play.atBatIndex}`, { ...play, game });
  }

  return (
    <>
      <PlaysTicker plays={[...plays.values()].slice(-TICKER_PLAYS).reverse()} />
      <GameGrid games={games.map((game) => patchGame(game, liveGames.get(game.gamePk)))} />
    </>
  );
}
