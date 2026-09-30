"use client";

import { useRealtime } from "inngest/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { GameGrid } from "@/components/game-grid";
import { LIVE_TOPICS, scoreboardChannel } from "@/inngest/channels";
import { scoreboardToken } from "@/inngest/realtime-tokens";
import { patchGame, type LiveGame, type LivePlay } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";

const REFRESH_EVERY_MS = 10_000;

export function LiveScoreboard({ games }: { games: Game[] }) {
  const router = useRouter();
  const { messages } = useRealtime({
    channel: scoreboardChannel,
    topics: LIVE_TOPICS,
    token: scoreboardToken,
    enabled: games.some((game) => !game.completed),
    autoCloseOnTerminal: false,
    historyLimit: 500,
  });

  const gamesByPk = new Map(games.map((game) => [game.gamePk, game]));

  const stats = messages.byTopic.stats;
  const statsChangedToday = stats ? gamesByPk.has(stats.data.gamePk) : false;
  const lastRefreshAt = useRef(0);
  useEffect(() => {
    if (!statsChangedToday) return;
    // Many games derive at once; refresh at most every 10s.
    const wait = Math.max(0, lastRefreshAt.current + REFRESH_EVERY_MS - Date.now());
    const timer = setTimeout(() => {
      lastRefreshAt.current = Date.now();
      router.refresh();
    }, wait);
    return () => clearTimeout(timer);
  }, [stats, statsChangedToday, router]);

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
