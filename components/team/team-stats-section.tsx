import type { ReactNode } from "react";
import { StatComparison, type ComparedStat } from "@/components/team/stat-comparison";
import { StatTable, type StatColumn } from "@/components/team/stat-table";
import { formatAverage, formatCount, formatDecimal, formatInnings, formatPercent } from "@/lib/format";
import type {
  BattingStats,
  HitterLeader,
  PitcherLeader,
  PitchingStats,
  PitchMixEntry,
  TeamStats,
} from "@/lib/team-stats";

const formatWhole = (value: number | null) => formatDecimal(value, 0);
const formatTwoDecimals = (value: number | null) => formatDecimal(value, 2);

const battingComparison: ComparedStat<BattingStats>[] = [
  { label: "AVG", value: (s) => s.avg, format: formatAverage, better: "higher" },
  { label: "OBP", value: (s) => s.obp, format: formatAverage, better: "higher" },
  { label: "SLG", value: (s) => s.slg, format: formatAverage, better: "higher" },
  { label: "OPS", value: (s) => s.ops, format: formatAverage, better: "higher" },
  { label: "ISO", value: (s) => s.iso, format: formatAverage, better: "higher" },
  { label: "HR", value: (s) => s.homeRuns, format: formatWhole, better: "higher" },
  { label: "K%", value: (s) => s.strikeoutRate, format: formatPercent, better: "lower" },
  { label: "BB%", value: (s) => s.walkRate, format: formatPercent, better: "higher" },
  { label: "Exit velo", value: (s) => s.exitVelocity, format: formatDecimal, better: "higher" },
  { label: "Hard-hit%", value: (s) => s.hardHitRate, format: formatPercent, better: "higher" },
  { label: "Chase%", value: (s) => s.chaseRate, format: formatPercent, better: "lower" },
  { label: "Z-contact%", value: (s) => s.zoneContactRate, format: formatPercent, better: "higher" },
];

const pitchingComparison: ComparedStat<PitchingStats>[] = [
  { label: "RA9", value: (s) => s.ra9, format: formatTwoDecimals, better: "lower" },
  { label: "WHIP", value: (s) => s.whip, format: formatTwoDecimals, better: "lower" },
  { label: "K%", value: (s) => s.strikeoutRate, format: formatPercent, better: "higher" },
  { label: "BB%", value: (s) => s.walkRate, format: formatPercent, better: "lower" },
  { label: "Whiff%", value: (s) => s.whiffRate, format: formatPercent, better: "higher" },
  { label: "CSW%", value: (s) => s.cswRate, format: formatPercent, better: "higher" },
  { label: "FB velo", value: (s) => s.fastballVelocity, format: formatDecimal, better: "higher" },
];

type Split = { label: string; stats: BattingStats };

const splitColumns: StatColumn<Split>[] = [
  { label: "PA", value: (r) => formatCount(r.stats.plateAppearances) },
  { label: "AVG", value: (r) => formatAverage(r.stats.avg) },
  { label: "OBP", value: (r) => formatAverage(r.stats.obp) },
  { label: "SLG", value: (r) => formatAverage(r.stats.slg) },
  { label: "OPS", value: (r) => formatAverage(r.stats.ops) },
  { label: "K%", value: (r) => formatPercent(r.stats.strikeoutRate) },
  { label: "BB%", value: (r) => formatPercent(r.stats.walkRate) },
];

type Staff = { label: string; stats: PitchingStats };

const staffColumns: StatColumn<Staff>[] = [
  { label: "IP", value: (r) => formatInnings(r.stats.inningsPitched) },
  { label: "RA9", value: (r) => formatTwoDecimals(r.stats.ra9) },
  { label: "WHIP", value: (r) => formatTwoDecimals(r.stats.whip) },
  { label: "K%", value: (r) => formatPercent(r.stats.strikeoutRate) },
  { label: "BB%", value: (r) => formatPercent(r.stats.walkRate) },
  { label: "Whiff%", value: (r) => formatPercent(r.stats.whiffRate) },
];

const pitchMixColumns: StatColumn<PitchMixEntry>[] = [
  { label: "#", value: (r) => formatCount(r.pitches) },
  { label: "Usage", value: (r) => formatPercent(r.usage) },
  { label: "Velo", value: (r) => formatDecimal(r.velocity) },
  { label: "Whiff%", value: (r) => formatPercent(r.whiffRate) },
];

const hitterColumns: StatColumn<HitterLeader>[] = [
  { label: "PA", value: (r) => formatCount(r.plateAppearances) },
  { label: "AVG", value: (r) => formatAverage(r.avg) },
  { label: "OBP", value: (r) => formatAverage(r.obp) },
  { label: "SLG", value: (r) => formatAverage(r.slg) },
  { label: "OPS", value: (r) => formatAverage(r.ops) },
  { label: "HR", value: (r) => formatCount(r.homeRuns) },
];

const pitcherColumns: StatColumn<PitcherLeader>[] = [
  { label: "IP", value: (r) => formatInnings(r.inningsPitched) },
  { label: "BF", value: (r) => formatCount(r.battersFaced) },
  { label: "K%", value: (r) => formatPercent(r.strikeoutRate) },
  { label: "BB%", value: (r) => formatPercent(r.walkRate) },
  { label: "RA9", value: (r) => formatTwoDecimals(r.ra9) },
];

function StatGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

export function TeamStatsSection({ stats }: { stats: TeamStats }) {
  const { batting, battingSplits, pitching, pitchMix, leaders } = stats;

  const splits: Split[] = [
    { label: "vs LHP", stats: battingSplits.vsLeft },
    { label: "vs RHP", stats: battingSplits.vsRight },
    { label: "Home", stats: battingSplits.home },
    { label: "Away", stats: battingSplits.away },
    { label: "RISP", stats: battingSplits.risp },
    { label: "Bases empty", stats: battingSplits.basesEmpty },
  ];

  const staff: Staff[] = [
    { label: "Starters", stats: pitching.starters },
    { label: "Bullpen", stats: pitching.bullpen },
  ];

  return (
    <div className="flex flex-col gap-8">
      <StatGroup title="Batting">
        <StatComparison title="Team vs league" stats={battingComparison} team={batting.team} league={batting.league} />
        <StatTable
          title="Splits"
          rowLabel="Split"
          rows={splits}
          rowKey={(r) => r.label}
          rowName={(r) => r.label}
          columns={splitColumns}
        />
      </StatGroup>

      <StatGroup title="Pitching">
        <StatComparison title="Team vs league" stats={pitchingComparison} team={pitching.team} league={pitching.league} />
        <div className="flex min-w-0 flex-col gap-4">
          <StatTable
            title="Starters vs bullpen"
            rowLabel="Role"
            rows={staff}
            rowKey={(r) => r.label}
            rowName={(r) => r.label}
            columns={staffColumns}
          />
          <StatTable
            title="Pitch mix"
            rowLabel="Pitch"
            rows={pitchMix}
            rowKey={(r) => r.pitchType}
            rowName={(r) => r.description || r.pitchType}
            columns={pitchMixColumns}
          />
        </div>
      </StatGroup>

      <StatGroup title="Leaders">
        <StatTable
          title="Hitters"
          rowLabel="Player"
          rows={leaders.hitters}
          rowKey={(r) => r.playerId}
          rowName={(r) => r.name}
          columns={hitterColumns}
        />
        <StatTable
          title="Pitchers"
          rowLabel="Player"
          rows={leaders.pitchers}
          rowKey={(r) => r.playerId}
          rowName={(r) => r.name}
          columns={pitcherColumns}
        />
      </StatGroup>
    </div>
  );
}
