import { Suspense } from "react";
import { GameLogLink } from "@/components/player/game-log-link";
import { SeasonLine } from "@/components/player/season-line";
import { StatTable, type StatColumn } from "@/components/stat-table";
import { Abbr } from "@/components/ui/abbr";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatDecimal, formatInnings, formatPercent } from "@/lib/format";
import { pitcherGameLog, pitcherSeason, type PitcherGameLogEntry } from "@/lib/stats/pitching";

const formatTwoDecimals = (value: number | null) => formatDecimal(value, 2);

const gameLogColumns: StatColumn<PitcherGameLogEntry>[] = [
  { label: "Dec", value: (g) => g.decisions.join(", ") },
  { label: "IP", value: (g) => formatInnings(g.inningsPitched) },
  { label: "H", value: (g) => g.hits },
  { label: "R", value: (g) => g.runs },
  { label: "ER", value: (g) => g.earnedRuns },
  { label: "BB", value: (g) => g.walks },
  { label: "K", value: (g) => g.strikeouts },
  { label: "HR", value: (g) => g.homeRuns },
  { label: "NP", value: (g) => g.pitches },
];

export function PitchingSections({ playerId, season }: { playerId: number; season: number }) {
  return (
    <>
      <Suspense fallback={<CardSkeleton className="h-12" />}>
        <PitchingSeasonLine playerId={playerId} season={season} />
      </Suspense>
      <Suspense fallback={<CardSkeleton className="h-64" />}>
        <PitchingGameLog playerId={playerId} season={season} />
      </Suspense>
    </>
  );
}

async function PitchingSeasonLine({ playerId, season }: { playerId: number; season: number }) {
  const stats = await pitcherSeason(playerId, season);

  return (
    <SeasonLine
      title={`${season} pitching`}
      stats={[
        { key: "ip", label: <Abbr term="IP" />, value: formatInnings(stats.inningsPitched) },
        { key: "era", label: <Abbr term="ERA" />, value: formatTwoDecimals(stats.era) },
        { key: "whip", label: <Abbr term="WHIP" />, value: formatTwoDecimals(stats.whip) },
        { key: "k", label: <Abbr term="K%" />, value: formatPercent(stats.strikeoutRate) },
        { key: "bb", label: <Abbr term="BB%" />, value: formatPercent(stats.walkRate) },
        { key: "csw", label: <Abbr term="CSW%" />, value: formatPercent(stats.cswRate) },
        { key: "velo", label: <Abbr term="FB velo" />, value: formatDecimal(stats.fastballVelocity) },
      ]}
    />
  );
}

async function PitchingGameLog({ playerId, season }: { playerId: number; season: number }) {
  const games = await pitcherGameLog(playerId, season);

  return (
    <StatTable
      title="Game log"
      rowLabel="Game"
      rows={games.toReversed()}
      rowKey={(g) => g.gamePk}
      rowName={(g) => <GameLogLink game={g} />}
      columns={gameLogColumns}
    />
  );
}
