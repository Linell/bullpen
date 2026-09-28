import type { ReactNode } from "react";
import { StatGrid, type StatColumn } from "@/components/stat-table";
import { formatAverage, formatCount, formatPercent } from "@/lib/format";
import type { BattingStats } from "@/lib/stats/rates";

export type Split = { key: string; label: ReactNode; stats: BattingStats };

const rateColumns: StatColumn<Split>[] = [
  { label: "AVG", value: (r) => formatAverage(r.stats.avg) },
  { label: "OBP", value: (r) => formatAverage(r.stats.obp) },
  { label: "SLG", value: (r) => formatAverage(r.stats.slg) },
  { label: "OPS", value: (r) => formatAverage(r.stats.ops) },
  { label: "K%", value: (r) => formatPercent(r.stats.strikeoutRate) },
  { label: "BB%", value: (r) => formatPercent(r.stats.walkRate) },
];

export function SplitTable({ splits, countLabel }: { splits: Split[]; countLabel: "PA" | "BF" }) {
  const columns: StatColumn<Split>[] = [
    { label: countLabel, value: (r) => formatCount(r.stats.plateAppearances) },
    ...rateColumns,
  ];

  return (
    <StatGrid rowLabel="Split" rows={splits} rowKey={(r) => r.key} rowName={(r) => r.label} columns={columns} />
  );
}
