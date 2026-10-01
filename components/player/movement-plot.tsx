"use client";

import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, type ScatterShapeProps } from "recharts";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/components/ui/chart";
import { formatDecimal, formatPercent } from "@/lib/format";

export type MovementPitch = {
  pitchType: string;
  name: string;
  ivb: number;
  hb: number;
  velocity: number | null;
  usage: number | null;
};

type MovementPoint = MovementPitch & { isLeague: boolean };

const PITCH_COLORS: Record<string, string> = {
  FF: "var(--chart-2)",
  SI: "var(--chart-6)",
  FC: "var(--chart-7)",
  SL: "var(--chart-3)",
  ST: "var(--chart-8)",
  CU: "var(--chart-1)",
  KC: "var(--chart-5)",
  CH: "var(--chart-4)",
  FS: "var(--chart-9)",
};

const OTHER_COLOR = "var(--foreground)";
const DOMAIN: [number, number] = [-25, 25];
const TICKS = [-20, -10, 0, 10, 20];

const HB_LABELS: Record<string, string> = {
  R: "Glove side ← HB (in) → Arm side",
  L: "Arm side ← HB (in) → Glove side",
};

function markerRadius(usage: number | null) {
  return 5 + Math.sqrt(usage ?? 0) * 12;
}

function PitchMarker({ cx, cy, payload }: ScatterShapeProps & { payload?: MovementPoint }) {
  if (cx == null || cy == null || !payload) return null;
  const fill = `var(--color-${payload.pitchType})`;

  if (payload.isLeague) {
    return <circle cx={cx} cy={cy} r={7} fill="none" stroke={fill} strokeWidth={2} strokeDasharray="3 2" />;
  }

  return <circle cx={cx} cy={cy} r={markerRadius(payload.usage)} fill={fill} stroke="var(--border)" strokeWidth={2} />;
}

function MovementTooltip({ point }: { point?: MovementPoint }) {
  if (!point) return null;

  return (
    <div className="grid min-w-32 gap-1 rounded-base border-2 border-border bg-secondary-background px-2.5 py-1.5 text-xs shadow-shadow">
      <div className="font-heading">
        {point.name}
        {point.isLeague && " (league avg)"}
      </div>
      <div>IVB {formatDecimal(point.ivb)} in</div>
      <div>HB {formatDecimal(point.hb)} in</div>
      <div>Velo {formatDecimal(point.velocity)} mph</div>
      {!point.isLeague && <div>Usage {formatPercent(point.usage)}</div>}
    </div>
  );
}

export function MovementPlot({
  pitches,
  league,
  pitchHand,
}: {
  pitches: MovementPitch[];
  league: MovementPitch[];
  pitchHand: string | null;
}) {
  const chartConfig = Object.fromEntries(
    pitches.map((p) => [p.pitchType, { label: p.name, color: PITCH_COLORS[p.pitchType] ?? OTHER_COLOR }]),
  ) satisfies ChartConfig;

  const leagueFor = (pitchType: string) => league.filter((l) => l.pitchType === pitchType);

  return (
    <figure className="grid gap-2">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full max-w-md"
        aria-label={`Pitch movement for ${pitches.length} pitch types compared with league average`}
      >
        <ScatterChart accessibilityLayer margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="hb"
            domain={DOMAIN}
            ticks={TICKS}
            allowDataOverflow
            tickLine={false}
            label={{
              value: HB_LABELS[pitchHand ?? ""] ?? "HB (in)",
              position: "insideBottom",
              offset: -8,
            }}
          />
          <YAxis
            type="number"
            dataKey="ivb"
            domain={DOMAIN}
            ticks={TICKS}
            allowDataOverflow
            tickLine={false}
            width={48}
            label={{
              value: "IVB (in)",
              angle: -90,
              position: "insideLeft",
              offset: 12,
            }}
          />
          <ReferenceLine x={0} className="stroke-foreground opacity-60" />
          <ReferenceLine y={0} className="stroke-foreground opacity-60" />
          <ChartTooltip content={({ payload }) => <MovementTooltip point={payload?.[0]?.payload} />} />
          <ChartLegend content={<ChartLegendContent nameKey="value" className="flex-wrap" />} />
          {pitches.map((p) => (
            <Scatter
              key={`league-${p.pitchType}`}
              data={leagueFor(p.pitchType).map((l) => ({
                ...l,
                isLeague: true,
              }))}
              legendType="none"
              shape={PitchMarker}
            />
          ))}
          {pitches.map((p) => (
            <Scatter
              key={p.pitchType}
              name={p.pitchType}
              data={[{ ...p, isLeague: false }]}
              fill={`var(--color-${p.pitchType})`}
              shape={PitchMarker}
            />
          ))}
        </ScatterChart>
      </ChartContainer>
      <figcaption className="text-center text-xs opacity-70">
        Filled: this pitcher, sized by usage. Dashed ring: league average
        {pitchHand && ` for ${pitchHand}HP`}.
      </figcaption>
    </figure>
  );
}
