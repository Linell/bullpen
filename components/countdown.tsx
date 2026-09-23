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
  if (now === undefined) return null;

  const remaining = formatCountdown(Date.parse(startTime) - now);
  if (!remaining) return null;
  return <p className="font-heading">First pitch in {remaining}</p>;
}
