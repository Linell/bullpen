"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RunDiffPoint } from "@/lib/team-trends";

const chartConfig = {
  cumulative: { label: "Cumulative", color: "var(--chart-1)" },
  rolling10: { label: "Last 10 games", color: "var(--chart-2)" },
} satisfies ChartConfig;

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function RunDiffChart({ points }: { points: RunDiffPoint[] }) {
  if (points.length === 0) return <p className="text-sm opacity-70">No completed games yet.</p>;

  const last = points[points.length - 1];

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-[3/1] w-full"
      aria-label={`Run differential over ${points.length} games, ending at ${signed(last.cumulative)}`}
    >
      <LineChart accessibilityLayer data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis tickLine={false} axisLine={false} width={36} tickFormatter={signed} />
        <ReferenceLine y={0} className="stroke-foreground opacity-40" strokeDasharray="4 4" />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="rolling10"
          type="monotone"
          stroke="var(--color-rolling10)"
          style={{ stroke: "var(--color-rolling10)", strokeWidth: 2 }}
          dot={false}
        />
        <Line
          dataKey="cumulative"
          type="monotone"
          stroke="var(--color-cumulative)"
          style={{ stroke: "var(--color-cumulative)", strokeWidth: 3 }}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
