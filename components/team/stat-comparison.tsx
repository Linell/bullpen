import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import type { GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

export type ComparedStat<Stats> = {
  label: GlossaryTerm;
  value: (stats: Stats) => number | null;
  format: (value: number | null) => string;
  better: "higher" | "lower";
};

type Standing = "better" | "worse" | "even";

function standing(team: number | null, league: number | null, better: "higher" | "lower"): Standing {
  if (team === null || league === null || team === league) return "even";
  return team > league === (better === "higher") ? "better" : "worse";
}

const marker: Record<Standing, { symbol: string; label: string; className: string }> = {
  better: { symbol: "▲", label: "better than league", className: "text-chart-4" },
  worse: { symbol: "▼", label: "worse than league", className: "text-chart-2" },
  even: { symbol: "", label: "", className: "" },
};

function StatTile<Stats>({ stat, team, league }: { stat: ComparedStat<Stats>; team: Stats; league: Stats }) {
  const teamValue = stat.value(team);
  const leagueValue = stat.value(league);
  const teamText = stat.format(teamValue);
  const leagueText = stat.format(leagueValue);
  const mark = marker[teamText === leagueText ? "even" : standing(teamValue, leagueValue, stat.better)];

  return (
    <div className="flex flex-col gap-0.5 rounded-base border-2 border-border bg-background px-2.5 py-2">
      <span className="text-xs opacity-70">
        <Abbr term={stat.label} />
      </span>
      <span className="flex items-baseline gap-1 font-heading text-lg tabular-nums">
        {teamText}
        {mark.symbol && (
          <span aria-label={mark.label} title={mark.label} className={cn("text-xs", mark.className)}>
            {mark.symbol}
          </span>
        )}
      </span>
      <span className="text-xs tabular-nums opacity-70"><Abbr term="Lg" /> {leagueText}</span>
    </div>
  );
}

export function StatComparison<Stats>({
  title,
  stats,
  team,
  league,
}: {
  title: string;
  stats: ComparedStat<Stats>[];
  team: Stats;
  league: Stats;
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardContent className="flex flex-col gap-2">
        <h3 className="font-heading">{title}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatTile key={stat.label} stat={stat} team={team} league={league} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
