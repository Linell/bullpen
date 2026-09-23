"use client";

import { useSyncExternalStore } from "react";
import { formatCountdown } from "@/lib/dates";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 15_000);
  return () => clearInterval(id);
}

function currentMinute() {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

export function Countdown({ startTime }: { startTime: string }) {
  const now = useSyncExternalStore(subscribe, currentMinute, () => undefined);
  const remaining = now === undefined ? undefined : formatCountdown(Date.parse(startTime) - now);

  if (!remaining) return <span className="text-xl font-heading opacity-70">@</span>;
  return (
    <span className="flex flex-col items-center">
      <span className="text-xs opacity-70">First pitch</span>
      <span className="font-heading tabular-nums whitespace-nowrap">{remaining}</span>
    </span>
  );
}
