import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export type SeasonStat = { key: string; label: ReactNode; value: string };

export function SeasonLine({ title, stats }: { title: string; stats: SeasonStat[] }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2 className="font-heading">{title}</h2>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {stats.map((stat) => (
            <div key={stat.key} className="flex flex-col">
              <dt className="text-xs opacity-70">{stat.label}</dt>
              <dd className="text-xl font-heading tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
