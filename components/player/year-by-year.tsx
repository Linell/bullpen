import Link from "next/link";
import { StatGrid, type StatColumn } from "@/components/stat-table";
import { playerPath, type PlayerRole } from "@/lib/routes";

export function YearByYear<Year extends { season: number }>({
  playerId,
  role,
  season,
  years,
  columns,
}: {
  playerId: number;
  role: PlayerRole;
  season: number;
  years: Year[];
  columns: StatColumn<Year>[];
}) {
  const latestSeason = years.at(-1)?.season;

  return (
    <StatGrid
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
      columns={columns}
      isHighlighted={(y) => y.season === season}
    />
  );
}
