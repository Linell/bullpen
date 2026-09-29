"use client";

import { useEffect, useState } from "react";
import { scoringSide, type Runs, type ScoringSide } from "@/lib/scoring";

const FLASH_MS = 4_000;
const SETTLED_MS = 60_000;

type Alert = { side: ScoringSide; phase: "flash" | "settled" };

function useScoringAlert({ away, home }: Runs) {
  const [previous, setPrevious] = useState({ away, home });
  const [alert, setAlert] = useState<Alert>();

  if (away !== previous.away || home !== previous.home) {
    const side = scoringSide(previous, { away, home });
    setPrevious({ away, home });
    if (side) setAlert({ side, phase: "flash" });
  }

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(
      () => setAlert(alert.phase === "flash" ? { ...alert, phase: "settled" } : undefined),
      alert.phase === "flash" ? FLASH_MS : SETTLED_MS,
    );
    return () => clearTimeout(timer);
  }, [alert]);

  return alert;
}

export function ScoringAlert({ runs, teams }: { runs: Runs; teams: Record<ScoringSide, string> }) {
  const alert = useScoringAlert(runs);
  if (!alert) return null;

  return (
    <>
      {alert.phase === "flash" && <span aria-hidden className="scoring-flash" />}
      <span
        role="status"
        className="absolute -top-3 right-3 z-10 rounded-base border-2 border-border bg-chart-3 px-2 text-xs font-heading text-main-foreground motion-safe:animate-in motion-safe:zoom-in-50"
      >
        {teams[alert.side]} scored
      </span>
    </>
  );
}
