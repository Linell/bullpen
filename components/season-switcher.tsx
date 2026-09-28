import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SeasonSwitcher({
  seasons,
  season,
  href,
}: {
  seasons: number[];
  season: number;
  href: (season: number) => string;
}) {
  return (
    <nav aria-label="Seasons" className="flex flex-wrap gap-2">
      {seasons.map((s) => (
        <Link
          key={s}
          href={href(s)}
          aria-current={s === season ? "page" : undefined}
          className={buttonVariants({ variant: s === season ? "noShadow" : "neutral", size: "xs" })}
        >
          {s}
        </Link>
      ))}
    </nav>
  );
}
