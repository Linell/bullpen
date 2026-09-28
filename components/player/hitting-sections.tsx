import { Suspense } from "react";
import { GameLogLink } from "@/components/player/game-log-link";
import { SeasonLine } from "@/components/player/season-line";
import { StatTable, type StatColumn } from "@/components/stat-table";
import { Abbr } from "@/components/ui/abbr";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatAverage, formatCount, formatPercent } from "@/lib/format";
import { hitterGameLog, hitterSeason, type HitterGameLogEntry } from "@/lib/stats/hitting";

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

export function HittingSections({ playerId, season }: { playerId: number; season: number }) {
  return (
    <>
      <Suspense fallback={<CardSkeleton className="h-12" />}>
        <HittingSeasonLine playerId={playerId} season={season} />
      </Suspense>
      <Suspense fallback={<CardSkeleton className="h-64" />}>
        <HittingGameLog playerId={playerId} season={season} />
      </Suspense>
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

async function HittingGameLog({ playerId, season }: { playerId: number; season: number }) {
  const games = await hitterGameLog(playerId, season);

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
