import { Suspense } from "react";
import { GameLogLink } from "@/components/player/game-log-link";
import { PlayerSection } from "@/components/player/player-section";
import { SeasonLine, StatList } from "@/components/player/season-line";
import { SplitTable, type Split } from "@/components/player/split-table";
import { SprayChart } from "@/components/player/spray-chart";
import { YearByYear } from "@/components/player/year-by-year";
import { StatGrid, type StatColumn } from "@/components/stat-table";
import { Abbr } from "@/components/ui/abbr";
import { Accordion } from "@/components/ui/accordion";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatAverage, formatCount, formatDecimal, formatPercent } from "@/lib/format";
import {
  hitterGameLog,
  hitterSeason,
  hitterSplits,
  hitterSprayChart,
  hitterYears,
  type HitterGameLogEntry,
  type HitterYear,
} from "@/lib/stats/hitting";

const gameLogColumns: StatColumn<HitterGameLogEntry>[] = [
  { label: "PA", value: (g) => g.plateAppearances },
  { label: "AB", value: (g) => g.atBats },
  { label: "R", value: (g) => g.runs },
  { label: "H", value: (g) => g.hits },
  { label: "2B", value: (g) => g.doubles },
  { label: "3B", value: (g) => g.triples },
  { label: "HR", value: (g) => g.homeRuns },
  { label: "RBI", value: (g) => g.rbi },
  { label: "BB", value: (g) => g.walks },
  { label: "K", value: (g) => g.strikeouts },
  { label: "SB", value: (g) => g.stolenBases },
];

const yearColumns: StatColumn<HitterYear>[] = [
  { label: "PA", value: (y) => formatCount(y.stats.plateAppearances) },
  { label: "AVG", value: (y) => formatAverage(y.stats.avg) },
  { label: "OBP", value: (y) => formatAverage(y.stats.obp) },
  { label: "SLG", value: (y) => formatAverage(y.stats.slg) },
  { label: "OPS", value: (y) => formatAverage(y.stats.ops) },
  { label: "HR", value: (y) => formatCount(y.stats.homeRuns) },
  { label: "K%", value: (y) => formatPercent(y.stats.strikeoutRate) },
  { label: "BB%", value: (y) => formatPercent(y.stats.walkRate) },
];

export function HittingSections({ playerId, season }: { playerId: number; season: number }) {
  return (
    <>
      <Suspense fallback={<CardSkeleton className="h-12" />}>
        <HittingSeasonLine playerId={playerId} season={season} />
      </Suspense>
      <Accordion multiple defaultValue={["batted-ball"]}>
        <PlayerSection value="splits" title="Splits">
          <HittingSplits playerId={playerId} season={season} />
        </PlayerSection>
        <PlayerSection value="batted-ball" title="Batted ball">
          <BattedBall playerId={playerId} season={season} />
        </PlayerSection>
        <PlayerSection value="game-log" title="Game log">
          <HittingGameLog playerId={playerId} season={season} />
        </PlayerSection>
        <PlayerSection value="years" title="Year by year">
          <HittingYears playerId={playerId} season={season} />
        </PlayerSection>
      </Accordion>
    </>
  );
}

async function HittingSeasonLine({ playerId, season }: { playerId: number; season: number }) {
  const stats = await hitterSeason(playerId, season);
  const slashLine = [stats.avg, stats.obp, stats.slg].map(formatAverage).join("/");

  return (
    <SeasonLine
      title={`${season} hitting`}
      stats={[
        { key: "pa", label: <Abbr term="PA" />, value: formatCount(stats.plateAppearances) },
        {
          key: "slash",
          label: (
            <>
              <Abbr term="AVG" />/<Abbr term="OBP" />/<Abbr term="SLG" />
            </>
          ),
          value: slashLine,
        },
        { key: "ops", label: <Abbr term="OPS" />, value: formatAverage(stats.ops) },
        { key: "hr", label: <Abbr term="HR" />, value: formatCount(stats.homeRuns) },
        { key: "k", label: <Abbr term="K%" />, value: formatPercent(stats.strikeoutRate) },
        { key: "bb", label: <Abbr term="BB%" />, value: formatPercent(stats.walkRate) },
      ]}
    />
  );
}

async function HittingSplits({ playerId, season }: { playerId: number; season: number }) {
  const splits = await hitterSplits(playerId, season);

  const rows: Split[] = [
    { key: "vsLeft", label: <>vs <Abbr term="LHP" /></>, stats: splits.vsLeft },
    { key: "vsRight", label: <>vs <Abbr term="RHP" /></>, stats: splits.vsRight },
    { key: "home", label: "Home", stats: splits.home },
    { key: "away", label: "Away", stats: splits.away },
    { key: "risp", label: <Abbr term="RISP" />, stats: splits.risp },
    { key: "basesEmpty", label: "Bases empty", stats: splits.basesEmpty },
  ];

  return <SplitTable splits={rows} countLabel="PA" />;
}

async function BattedBall({ playerId, season }: { playerId: number; season: number }) {
  const [stats, balls] = await Promise.all([hitterSeason(playerId, season), hitterSprayChart(playerId, season)]);

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <StatList
        className="sm:flex-col"
        stats={[
          { key: "ev", label: <Abbr term="Exit velo" />, value: formatDecimal(stats.exitVelocity) },
          { key: "hard", label: <Abbr term="Hard-hit%" />, value: formatPercent(stats.hardHitRate) },
          { key: "barrel", label: <Abbr term="Barrel%" />, value: formatPercent(stats.barrelRate) },
          { key: "bbe", label: <Abbr term="Batted balls" />, value: formatCount(stats.battedBalls) },
        ]}
      />
      <SprayChart balls={balls} />
    </div>
  );
}

async function HittingYears({ playerId, season }: { playerId: number; season: number }) {
  const years = await hitterYears(playerId);
  return <YearByYear playerId={playerId} role="hitting" season={season} years={years} columns={yearColumns} />;
}

async function HittingGameLog({ playerId, season }: { playerId: number; season: number }) {
  const games = await hitterGameLog(playerId, season);

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
