import Link from "next/link";
import { PlayerLink } from "@/components/player-link";
import { StatTable, type StatColumn } from "@/components/stat-table";
import { formatShortDate } from "@/lib/dates";
import { formatAverage, formatCount, formatDecimal, formatInnings, formatPercent } from "@/lib/format";
import { gamePath, type PlayerRole } from "@/lib/routes";
import type { PlayerRef } from "@/lib/player-ref";
import type { BarrelLeader, EventLeader, HittingLeader, PitchingLeader, WhiffLeader } from "@/lib/stats/leaderboards";

type ValueLabel = "MPH" | "Distance";

const OPPONENT_ROLE = { hitting: "pitching", pitching: "hitting" } as const;

type RankedPlayerProps = { index: number; player: PlayerRef; role: PlayerRole; season: number };

function RankedPlayer({ index, player, role, season }: RankedPlayerProps) {
  return (
    <>
      <span className="mr-2 inline-block w-7 text-right tabular-nums opacity-70">{index + 1}</span>
      <PlayerLink playerId={player.id} role={role} season={season}>
        {player.name}
      </PlayerLink>
    </>
  );
}

function eventColumns(
  role: PlayerRole,
  season: number,
  valueLabel: ValueLabel,
  digits: number,
): StatColumn<EventLeader>[] {
  const opponentRole = OPPONENT_ROLE[role];
  return [
    { label: valueLabel, value: (leader) => formatDecimal(leader.value, digits) },
    { label: "Pitch", align: "left", value: (leader) => leader.pitchType ?? "—" },
    { label: "Count", value: (leader) => leader.count },
    {
      label: role === "hitting" ? "Pitcher" : "Batter",
      align: "left",
      value: (leader) => (
        <PlayerLink playerId={leader.opponent.id} role={opponentRole} season={season}>
          {leader.opponent.name}
        </PlayerLink>
      ),
    },
    { label: "Result", align: "left", value: (leader) => leader.result ?? "—" },
    {
      label: "Game",
      align: "left",
      value: (leader) => (
        <Link href={gamePath(leader.gamePk)} className="hover:underline">
          {leader.matchup} <span className="opacity-70">{formatShortDate(leader.date)}</span>
        </Link>
      ),
    },
  ];
}

export function EventBoard({
  title,
  leaders,
  role,
  season,
  valueLabel,
  digits,
}: {
  title: string;
  leaders: EventLeader[];
  role: PlayerRole;
  season: number;
  valueLabel: ValueLabel;
  digits: number;
}) {
  return (
    <StatTable
      heading="h2"
      title={title}
      rowLabel="Player"
      rows={leaders}
      rowKey={(_, index) => index}
      rowName={(leader, index) => <RankedPlayer index={index} player={leader.player} role={role} season={season} />}
      columns={eventColumns(role, season, valueLabel, digits)}
    />
  );
}

const HITTING_COLUMNS: StatColumn<HittingLeader>[] = [
  { label: "PA", value: (leader) => formatCount(leader.plateAppearances) },
  { label: "HR", value: (leader) => formatCount(leader.homeRuns) },
  { label: "AVG", value: (leader) => formatAverage(leader.avg) },
  { label: "OBP", value: (leader) => formatAverage(leader.obp) },
  { label: "SLG", value: (leader) => formatAverage(leader.slg) },
  { label: "OPS", value: (leader) => formatAverage(leader.ops) },
  { label: "K%", value: (leader) => formatPercent(leader.strikeoutRate) },
  { label: "BB%", value: (leader) => formatPercent(leader.walkRate) },
];

export function HittingBoard({ leaders, season }: { leaders: HittingLeader[]; season: number }) {
  return (
    <StatTable
      heading="h2"
      title="Hitting"
      rowLabel="Player"
      rows={leaders}
      rowKey={(_, index) => index}
      rowName={(leader, index) => <RankedPlayer index={index} player={leader.player} role="hitting" season={season} />}
      columns={HITTING_COLUMNS}
    />
  );
}

const PITCHING_COLUMNS: StatColumn<PitchingLeader>[] = [
  { label: "IP", value: (leader) => formatInnings(leader.inningsPitched) },
  { label: "ERA", value: (leader) => formatDecimal(leader.era, 2) },
  { label: "K", value: (leader) => formatCount(leader.strikeouts) },
  { label: "K%", value: (leader) => formatPercent(leader.strikeoutRate) },
  { label: "BB%", value: (leader) => formatPercent(leader.walkRate) },
  { label: "WHIP", value: (leader) => formatDecimal(leader.whip, 2) },
];

export function PitchingBoard({ leaders, season }: { leaders: PitchingLeader[]; season: number }) {
  return (
    <StatTable
      heading="h2"
      title="Pitching"
      rowLabel="Player"
      rows={leaders}
      rowKey={(_, index) => index}
      rowName={(leader, index) => <RankedPlayer index={index} player={leader.player} role="pitching" season={season} />}
      columns={PITCHING_COLUMNS}
    />
  );
}

const BARREL_COLUMNS: StatColumn<BarrelLeader>[] = [
  { label: "Batted balls", value: (leader) => formatCount(leader.battedBalls) },
  { label: "Barrel%", value: (leader) => formatPercent(leader.barrelRate) },
  { label: "Hard-hit%", value: (leader) => formatPercent(leader.hardHitRate) },
  { label: "Exit velo", value: (leader) => formatDecimal(leader.exitVelocity) },
];

export function BarrelBoard({ leaders, season }: { leaders: BarrelLeader[]; season: number }) {
  return (
    <StatTable
      heading="h2"
      title="Barrel rate"
      rowLabel="Player"
      rows={leaders}
      rowKey={(_, index) => index}
      rowName={(leader, index) => <RankedPlayer index={index} player={leader.player} role="hitting" season={season} />}
      columns={BARREL_COLUMNS}
    />
  );
}

const WHIFF_COLUMNS: StatColumn<WhiffLeader>[] = [
  { label: "NP", value: (leader) => formatCount(leader.pitches) },
  { label: "Whiff%", value: (leader) => formatPercent(leader.whiffRate) },
  { label: "Chase%", value: (leader) => formatPercent(leader.chaseRate) },
  { label: "CSW%", value: (leader) => formatPercent(leader.cswRate) },
];

export function WhiffBoard({ leaders, season }: { leaders: WhiffLeader[]; season: number }) {
  return (
    <StatTable
      heading="h2"
      title="Whiff rate"
      rowLabel="Player"
      rows={leaders}
      rowKey={(_, index) => index}
      rowName={(leader, index) => <RankedPlayer index={index} player={leader.player} role="pitching" season={season} />}
      columns={WHIFF_COLUMNS}
    />
  );
}
