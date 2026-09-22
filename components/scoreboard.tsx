"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { useRealtime } from "inngest/react";
import { getScoreboardToken } from "@/app/actions";
import { GameCard } from "@/components/game-card";
import { Card, CardContent } from "@/components/ui/card";
import { scoreboardChannel } from "@/lib/inngest/realtime";
import { mergeUpdates, type Game } from "@/lib/scoreboard";

const TOPICS = ["games"] as const;
const REFRESH_MS = 60_000;

async function token() {
  const t = await getScoreboardToken();
  if (!t) throw new Error("Realtime unavailable");
  return t;
}

export function Scoreboard({
  heading,
  dateLabel,
  emptyLabel,
  date,
  games: initialGames,
  live,
}: {
  heading: ReactNode;
  dateLabel: string;
  emptyLabel: string;
  date: string;
  games: Game[];
  // Whether this date can still change, so it's worth subscribing.
  live: boolean;
}) {
  const router = useRouter();
  const { messages, connectionStatus } = useRealtime({
    channel: scoreboardChannel,
    topics: TOPICS,
    token,
    enabled: live,
    historyLimit: 500,
    autoCloseOnTerminal: false,
    reconnectMaxMs: REFRESH_MS,
  });

  const games = useMemo(
    () => mergeUpdates(initialGames, messages.all, date),
    [initialGames, messages.all, date],
  );

  // Fall back to re-reading the database while realtime is down.
  const connected = connectionStatus === "open";
  useEffect(() => {
    if (!live || connected) return;
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [live, connected, router]);

  const liveCount = games.filter((g) => g.status.state === "live").length;

  return (
    <>
      <section className="flex flex-col gap-1">
        {heading}
        <p className="opacity-70">
          {dateLabel} · {games.length} {games.length === 1 ? "game" : "games"}
          {liveCount > 0 && ` · ${liveCount} live`}
        </p>
      </section>
      {games.length > 0 ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>
      ) : (
        <Card>
          <CardContent>{emptyLabel}</CardContent>
        </Card>
      )}
    </>
  );
}
