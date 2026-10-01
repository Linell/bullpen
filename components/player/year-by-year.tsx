import Link from "next/link";
import { StatGrid, type StatColumn } from "@/components/stat-table";
import { playerPath, type PlayerRole } from "@/lib/routes";

type Year<Stats> = { season: number; stats: Stats };

export function YearByYear<Stats>({
  playerId,
  role,
  season,
  years,
  career,
  columns,
}: {
  playerId: number;
  role: PlayerRole;
  season: number;
  years: Year<Stats>[];
  career: Stats;
  columns: StatColumn<Stats>[];
}) {
  const latestSeason = years.at(-1)?.season;
  const yearColumns = columns.map((column) => ({ ...column, value: (y: Year<Stats>) => column.value(y.stats) }));

  return (
    <StatGrid
      caption="Year by year"
      rowLabel="Season"
      rows={years}
      rowKey={(y) => y.season}
      rowName={(y) => (
        <Link
          href={playerPath(playerId, { role, season: y.season === latestSeason ? undefined : y.season })}
          aria-current={y.season === season ? "page" : undefined}
          className="hover:underline"
        >
          {y.season}
        </Link>
      )}
      columns={yearColumns}
      isHighlighted={(y) => y.season === season}
      totals={years.length > 1 ? { name: "Career", row: { season: 0, stats: career } } : undefined}
    />
  );
}
