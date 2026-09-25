import Link from "next/link";
import { teamPath } from "@/components/team/team-link";
import { buttonVariants } from "@/components/ui/button";

export function SeasonPicker({
  teamId,
  seasons,
  season,
}: {
  teamId: number;
  seasons: number[];
  season: number;
}) {
  const [currentSeason] = seasons;

  return (
    <nav aria-label="Seasons" className="flex flex-wrap gap-2">
      {seasons.map((s) => (
        <Link
          key={s}
          href={teamPath(teamId, s === currentSeason ? undefined : s)}
          aria-current={s === season ? "page" : undefined}
          className={buttonVariants({ variant: s === season ? "noShadow" : "neutral", size: "xs" })}
        >
          {s}
        </Link>
      ))}
    </nav>
  );
}
