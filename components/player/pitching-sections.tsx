import { Suspense } from "react";
import { GameLogLink } from "@/components/player/game-log-link";
import { PlayerSection } from "@/components/player/player-section";
import { SeasonLine } from "@/components/player/season-line";
import { SplitTable, type Split } from "@/components/player/split-table";
import { YearByYear } from "@/components/player/year-by-year";
import { StatGrid, type StatColumn } from "@/components/stat-table";
import { Abbr } from "@/components/ui/abbr";
import { Accordion } from "@/components/ui/accordion";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatCount, formatDecimal, formatInnings, formatPercent } from "@/lib/format";
import {
  pitcherArsenal,
  pitcherGameLog,
  pitcherSeason,
  pitcherSplits,
  pitcherYears,
  type ArsenalEntry,
  type PitcherGameLogEntry,
  type PitcherYear,
} from "@/lib/stats/pitching";

const formatWhole = (value: number | null) => formatDecimal(value, 0);
const formatTwoDecimals = (value: number | null) => formatDecimal(value, 2);

const arsenalColumns: StatColumn<ArsenalEntry>[] = [
  { label: "#", value: (p) => formatCount(p.pitches) },
  { label: "Usage", value: (p) => formatPercent(p.usage) },
  { label: "Velo", value: (p) => formatDecimal(p.velocity) },
  { label: "Spin", value: (p) => formatWhole(p.spinRate) },
  { label: "Whiff%", value: (p) => formatPercent(p.whiffRate) },
];

const yearColumns: StatColumn<PitcherYear>[] = [
  { label: "IP", value: (y) => formatInnings(y.stats.inningsPitched) },
  { label: "ERA", value: (y) => formatTwoDecimals(y.stats.era) },
  { label: "WHIP", value: (y) => formatTwoDecimals(y.stats.whip) },
  { label: "K%", value: (y) => formatPercent(y.stats.strikeoutRate) },
  { label: "BB%", value: (y) => formatPercent(y.stats.walkRate) },
  { label: "CSW%", value: (y) => formatPercent(y.stats.cswRate) },
  { label: "FB velo", value: (y) => formatDecimal(y.stats.fastballVelocity) },
];

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
      <Accordion multiple defaultValue={["arsenal"]}>
        <PlayerSection value="splits" title="Splits">
          <PitchingSplits playerId={playerId} season={season} />
        </PlayerSection>
        <PlayerSection value="arsenal" title="Arsenal">
          <Arsenal playerId={playerId} season={season} />
        </PlayerSection>
        <PlayerSection value="game-log" title="Game log">
          <PitchingGameLog playerId={playerId} season={season} />
        </PlayerSection>
        <PlayerSection value="years" title="Year by year">
          <PitchingYears playerId={playerId} season={season} />
        </PlayerSection>
      </Accordion>
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

async function PitchingSplits({ playerId, season }: { playerId: number; season: number }) {
  const splits = await pitcherSplits(playerId, season);

  const rows: Split[] = [
    { key: "vsLeft", label: <>vs <Abbr term="LHB" /></>, stats: splits.vsLeft },
    { key: "vsRight", label: <>vs <Abbr term="RHB" /></>, stats: splits.vsRight },
    { key: "home", label: "Home", stats: splits.home },
    { key: "away", label: "Away", stats: splits.away },
  ];

  return <SplitTable splits={rows} countLabel="BF" />;
}

async function Arsenal({ playerId, season }: { playerId: number; season: number }) {
  const arsenal = await pitcherArsenal(playerId, season);

  return (
    <StatGrid
      rowLabel="Pitch"
      rows={arsenal}
      rowKey={(p) => p.pitchType}
      rowName={(p) => p.description || p.pitchType}
      columns={arsenalColumns}
    />
  );
}

async function PitchingYears({ playerId, season }: { playerId: number; season: number }) {
  const years = await pitcherYears(playerId);
  return <YearByYear playerId={playerId} role="pitching" season={season} years={years} columns={yearColumns} />;
}

async function PitchingGameLog({ playerId, season }: { playerId: number; season: number }) {
  const games = await pitcherGameLog(playerId, season);

  return (
    <StatGrid
      rowLabel="Game"
      rows={games.toReversed()}
      rowKey={(g) => g.gamePk}
      rowName={(g) => <GameLogLink game={g} />}
      columns={gameLogColumns}
    />
  );
}
