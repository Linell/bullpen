import { useId } from "react";
import type { RunDiffPoint } from "@/lib/team-trends";

const WIDTH = 600;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

function linePath(values: number[], x: (i: number) => number, y: (v: number) => number) {
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function RunDiffChart({ points }: { points: RunDiffPoint[] }) {
  const titleId = useId();

  if (points.length === 0) return <p className="text-sm opacity-70">No completed games yet.</p>;

  const cumulative = points.map((p) => p.cumulative);
  const rolling = points.map((p) => p.rolling10);
  const max = Math.max(0, ...cumulative, ...rolling);
  const min = Math.min(0, ...cumulative, ...rolling);
  const range = max - min || 1;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotWidth : plotWidth / 2);
  const y = (v: number) => PAD.top + ((max - v) / range) * plotHeight;
  const last = points[points.length - 1];

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {`Run differential over ${points.length} games, ending at ${signed(last.cumulative)}`}
        </title>
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-foreground opacity-40"
          strokeDasharray="4 4"
        />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-foreground" />
        {[max, 0, min]
          .filter((v, i, all) => all.indexOf(v) === i)
          .map((v) => (
            <text
              key={v}
              x={PAD.left - 6}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={11}
              className="fill-foreground tabular-nums"
            >
              {signed(v)}
            </text>
          ))}
        <text x={PAD.left} y={HEIGHT - 6} fontSize={11} className="fill-foreground opacity-70">
          {points[0].date}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" fontSize={11} className="fill-foreground opacity-70">
          {last.date}
        </text>
        <path d={linePath(rolling, x, y)} fill="none" className="stroke-chart-2" strokeWidth={2} />
        <path d={linePath(cumulative, x, y)} fill="none" className="stroke-chart-1" strokeWidth={3} />
      </svg>
      <figcaption className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-chart-1" aria-hidden />
          Cumulative
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-chart-2" aria-hidden />
          Last 10 games
        </span>
      </figcaption>
    </figure>
  );
}
