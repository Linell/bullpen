import type { Pitch, PitchResult } from "@/lib/play-by-play";
import { PLATE_HALF_WIDTH, SCALE, VIEW, toSvgX, toSvgY } from "@/lib/strike-zone";
import { cn } from "@/lib/utils";

const DOT_RADIUS = 13;
const DEFAULT_ZONE = { top: 3.4, bottom: 1.6 };

export const RESULT_FILL: Record<PitchResult, string> = {
  ball: "fill-chart-4",
  strike: "fill-chart-2",
  in_play: "fill-chart-1",
};

export function StrikeZone({ pitches }: { pitches: Pitch[] }) {
  const dots = pitches.flatMap((p) =>
    p.plateX == null || p.plateZ == null ? [] : [{ pitch: p, x: toSvgX(p.plateX), y: toSvgY(p.plateZ) }],
  );
  const top = pitches.find((p) => p.zoneTop != null)?.zoneTop ?? DEFAULT_ZONE.top;
  const bottom = pitches.find((p) => p.zoneBottom != null)?.zoneBottom ?? DEFAULT_ZONE.bottom;
  const width = VIEW.right - VIEW.left;
  const height = VIEW.top - VIEW.bottom;

  return (
    <svg
      viewBox={`${VIEW.left} ${-VIEW.top} ${width} ${height}`}
      className="w-28 shrink-0 rounded-base border-2 border-border bg-background"
      role="img"
      aria-label="Pitch locations from the catcher's view"
    >
      <rect
        x={-PLATE_HALF_WIDTH * SCALE}
        y={toSvgY(top)}
        width={PLATE_HALF_WIDTH * 2 * SCALE}
        height={(top - bottom) * SCALE}
        className="fill-secondary-background stroke-foreground"
        strokeWidth={4}
      />
      {dots.map(({ pitch, x, y }) => (
        <g key={pitch.index}>
          <circle
            cx={x}
            cy={y}
            r={DOT_RADIUS}
            className={cn(RESULT_FILL[pitch.result], "stroke-border")}
            strokeWidth={2}
          />
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            className="fill-main-foreground font-heading"
          >
            {pitch.number}
          </text>
        </g>
      ))}
    </svg>
  );
}
