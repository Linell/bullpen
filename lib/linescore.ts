import type { Half } from "@/lib/play-by-play";

export type LinescoreRow = {
  inning: number;
  half: Half;
  runs: number | null;
  hits: number | null;
  errors: number | null;
};

export type LinescoreLine = {
  innings: string[];
  runs: number;
  hits: number;
  errors: number;
};

export type Linescore = {
  innings: number[];
  away: LinescoreLine;
  home: LinescoreLine;
};

const MIN_INNINGS = 9;

function linescoreLine(rows: LinescoreRow[], innings: number[], completed: boolean): LinescoreLine {
  const byInning = new Map(rows.map((r) => [r.inning, r]));
  const sum = (key: "runs" | "hits" | "errors") => rows.reduce((total, r) => total + (r[key] ?? 0), 0);
  return {
    innings: innings.map((inning) => {
      const row = byInning.get(inning);
      if (row?.runs != null) return String(row.runs);
      return row && completed ? "x" : "";
    }),
    runs: sum("runs"),
    hits: sum("hits"),
    errors: sum("errors"),
  };
}

export function toLinescore(rows: LinescoreRow[], completed: boolean): Linescore {
  const played = Math.max(MIN_INNINGS, ...rows.map((r) => r.inning));
  const innings = Array.from({ length: played }, (_, i) => i + 1);
  return {
    innings,
    away: linescoreLine(rows.filter((r) => r.half === "top"), innings, completed),
    home: linescoreLine(rows.filter((r) => r.half === "bottom"), innings, completed),
  };
}
