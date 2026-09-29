"use client";

import { useRealtime } from "inngest/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameGrid } from "@/components/game-grid";
import { SCOREBOARD_TOPICS, scoreboardChannel } from "@/inngest/channels";
import { scoreboardToken } from "@/inngest/realtime-tokens";
import { patchGame, type LiveGame, type LivePlay } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";

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
  const latestPlays = new Map<number, LivePlay>();
  for (const message of messages.all) {
    if (message.kind === "run") continue;
    if (message.topic === "game") liveGames.set(message.data.gamePk, message.data);
    const latest = message.topic === "play" && message.data.plays.at(-1);
    if (latest) latestPlays.set(message.data.gamePk, latest);
  }

  return (
    <GameGrid
      games={games.map((game) => patchGame(game, liveGames.get(game.gamePk)))}
      latestPlays={latestPlays}
    />
  );
}
