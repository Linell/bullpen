import Link from "next/link";
import { PlayerLink } from "@/components/player-link";
import { StatTable, type StatColumn } from "@/components/stat-table";
import { formatShortDate } from "@/lib/dates";
import { formatCount, formatDecimal, formatPercent } from "@/lib/format";
import { gamePath, type PlayerRole } from "@/lib/routes";
import type { PlayerRef } from "@/lib/player-ref";
import type { BarrelLeader, EventLeader, WhiffLeader } from "@/lib/stats/leaderboards";

type Ranked<Leader> = Leader & { rank: number };

type ValueLabel = "MPH" | "Distance";

const OPPONENT_ROLE = { hitting: "pitching", pitching: "hitting" } as const;

function rank<Leader>(leaders: Leader[]): Ranked<Leader>[] {
  return leaders.map((leader, i) => ({ ...leader, rank: i + 1 }));
}

function RankedPlayer({ leader, role }: { leader: Ranked<{ player: PlayerRef }>; role: PlayerRole }) {
  return (
    <>
      <span className="mr-2 opacity-70">{leader.rank}</span>
      <PlayerLink playerId={leader.player.id} role={role}>
        {leader.player.name}
      </PlayerLink>
    </>
  );
}

function eventColumns(role: PlayerRole, valueLabel: ValueLabel, digits: number): StatColumn<Ranked<EventLeader>>[] {
  const opponentRole = OPPONENT_ROLE[role];
  return [
    { label: valueLabel, value: (leader) => formatDecimal(leader.value, digits) },
    { label: "Pitch", align: "left", value: (leader) => leader.pitchType ?? "—" },
    { label: "Count", value: (leader) => leader.count },
    {
      label: role === "hitting" ? "Pitcher" : "Batter",
      align: "left",
      value: (leader) => (
        <PlayerLink playerId={leader.opponent.id} role={opponentRole}>
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
  valueLabel,
  digits,
}: {
  title: string;
  leaders: EventLeader[];
  role: PlayerRole;
  valueLabel: ValueLabel;
  digits: number;
}) {
  return (
    <StatTable
      title={title}
      rowLabel="Player"
      rows={rank(leaders)}
      rowKey={(leader) => leader.rank}
      rowName={(leader) => <RankedPlayer leader={leader} role={role} />}
      columns={eventColumns(role, valueLabel, digits)}
    />
  );
}

const BARREL_COLUMNS: StatColumn<Ranked<BarrelLeader>>[] = [
  { label: "Batted balls", value: (leader) => formatCount(leader.battedBalls) },
  { label: "Barrel%", value: (leader) => formatPercent(leader.barrelRate) },
  { label: "Hard-hit%", value: (leader) => formatPercent(leader.hardHitRate) },
  { label: "Exit velo", value: (leader) => formatDecimal(leader.exitVelocity) },
];

export function BarrelBoard({ leaders }: { leaders: BarrelLeader[] }) {
  return (
    <StatTable
      title="Barrel rate"
      rowLabel="Player"
      rows={rank(leaders)}
      rowKey={(leader) => leader.rank}
      rowName={(leader) => <RankedPlayer leader={leader} role="hitting" />}
      columns={BARREL_COLUMNS}
    />
  );
}

const WHIFF_COLUMNS: StatColumn<Ranked<WhiffLeader>>[] = [
  { label: "NP", value: (leader) => formatCount(leader.pitches) },
  { label: "Whiff%", value: (leader) => formatPercent(leader.whiffRate) },
  { label: "Chase%", value: (leader) => formatPercent(leader.chaseRate) },
  { label: "CSW%", value: (leader) => formatPercent(leader.cswRate) },
];

export function WhiffBoard({ leaders }: { leaders: WhiffLeader[] }) {
  return (
    <StatTable
      title="Whiff rate"
      rowLabel="Player"
      rows={rank(leaders)}
      rowKey={(leader) => leader.rank}
      rowName={(leader) => <RankedPlayer leader={leader} role="pitching" />}
      columns={WHIFF_COLUMNS}
    />
  );
}
