import { Suspense } from "react";
import { GameLogLink } from "@/components/player/game-log-link";
import { PercentileBars, percentileBar } from "@/components/player/percentile-bars";
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
} from "@/lib/stats/hitting";
import type { BattingStats } from "@/lib/stats/rates";
import { hittingPercentiles } from "@/lib/stats/percentiles";

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

const yearColumns: StatColumn<BattingStats>[] = [
  { label: "PA", value: (s) => formatCount(s.plateAppearances) },
  { label: "HR", value: (s) => formatCount(s.homeRuns) },
  { label: "AVG", value: (s) => formatAverage(s.avg) },
  { label: "OBP", value: (s) => formatAverage(s.obp) },
  { label: "SLG", value: (s) => formatAverage(s.slg) },
  { label: "OPS", value: (s) => formatAverage(s.ops) },
  { label: "K%", value: (s) => formatPercent(s.strikeoutRate) },
  { label: "BB%", value: (s) => formatPercent(s.walkRate) },
];

export function HittingSections({ playerId, season }: { playerId: number; season: number }) {
  return (
    <>
      <Suspense fallback={<CardSkeleton className="h-12" />}>
        <HittingSeasonLine playerId={playerId} season={season} />
      </Suspense>
      <Suspense fallback={<CardSkeleton className="h-48" />}>
        <HittingPercentiles playerId={playerId} season={season} />
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

async function HittingPercentiles({ playerId, season }: { playerId: number; season: number }) {
  const { threshold, percentiles: p } = await hittingPercentiles(playerId, season);

  return (
    <PercentileBars
      qualifier={`${threshold} PA`}
      groups={
        p && [
          {
            title: "Contact quality",
            bars: [
              percentileBar("Exit velo", p.exitVelocity, formatDecimal),
              percentileBar("Hard-hit%", p.hardHitRate, formatPercent),
              percentileBar("Barrel%", p.barrelRate, formatPercent),
            ],
          },
          {
            title: "Discipline",
            bars: [
              percentileBar("K%", p.strikeoutRate, formatPercent),
              percentileBar("BB%", p.walkRate, formatPercent),
              percentileBar("Whiff%", p.whiffRate, formatPercent),
              percentileBar("Chase%", p.chaseRate, formatPercent),
            ],
          },
          { title: "Results", bars: [percentileBar("OPS", p.ops, formatAverage)] },
        ]
      }
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
  const { years, career } = await hitterYears(playerId);
  return (
    <YearByYear playerId={playerId} role="hitting" season={season} years={years} career={career} columns={yearColumns} />
  );
}

async function HittingGameLog({ playerId, season }: { playerId: number; season: number }) {
  const games = await hitterGameLog(playerId, season);

  return (
    <StatGrid
      caption="Game log"
      rowLabel="Game"
      rows={games.toReversed()}
      rowKey={(g) => g.gamePk}
      rowName={(g) => <GameLogLink game={g} />}
      columns={gameLogColumns}
    />
  );
}
