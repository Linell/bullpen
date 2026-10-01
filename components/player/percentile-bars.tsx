import type { ReactNode } from "react";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import type { GlossaryTerm } from "@/lib/glossary";
import type { Percentile } from "@/lib/stats/percentiles";

type PercentileBar = { key: string; label: ReactNode; value: string; percentile: number | null };
type PercentileGroup = { title: string; bars: PercentileBar[] };

const LOW = "hsl(0 75% 50%)";
const AVERAGE = "hsl(220 10% 62%)";
const HIGH = "hsl(220 80% 50%)";

export function percentileBar(term: GlossaryTerm, stat: Percentile | null, format: (value: number) => string): PercentileBar {
  return {
    key: term,
    label: <Abbr term={term} />,
    value: stat ? format(stat.value) : "—",
    percentile: stat?.percentile ?? null,
  };
}

function percentileColor(percentile: number) {
  const toward = percentile < 50 ? LOW : HIGH;
  return `color-mix(in oklab, ${toward} ${Math.abs(percentile - 50) * 2}%, ${AVERAGE})`;
}

export function PercentileBars({ groups, qualifier }: { groups?: PercentileGroup[]; qualifier: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2>
          <Abbr term="Percentile">Percentiles</Abbr>
        </h2>
        {groups ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {groups.map((group) => (
              <section key={group.title} className="flex flex-col gap-3">
                <h3 className="text-xs opacity-70">{group.title}</h3>
                {group.bars.map((bar) => (
                  <PercentileRow key={bar.key} bar={bar} />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm opacity-70">Not qualified: needs {qualifier} this season.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PercentileRow({ bar }: { bar: PercentileBar }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-sm">
      <span>{bar.label}</span>
      <div className="relative mx-3.5 h-3 rounded-full border-2 border-border bg-secondary-background">
        {bar.percentile !== null && (
          <>
            <div
              className="h-full rounded-full"
              style={{ width: `${bar.percentile}%`, backgroundColor: percentileColor(bar.percentile) }}
            />
            <span
              className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-border font-heading text-xs text-white tabular-nums"
              style={{ left: `${bar.percentile}%`, backgroundColor: percentileColor(bar.percentile) }}
            >
              {bar.percentile}
            </span>
          </>
        )}
      </div>
      <span className="text-right tabular-nums">{bar.value}</span>
    </div>
  );
}
