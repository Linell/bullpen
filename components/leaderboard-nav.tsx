import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { LIMITS, RANGE_KEYS, RANGES, type LeaderboardSearch } from "@/lib/leaderboard-range";
import { leadersPath } from "@/lib/routes";

function OptionLink({ href, isSelected, children }: { href: string; isSelected: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={isSelected ? "page" : undefined}
      className={buttonVariants({ variant: isSelected ? "noShadow" : "neutral", size: "xs" })}
    >
      {children}
    </Link>
  );
}

export function LeaderboardNav({ range, limit }: LeaderboardSearch) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <nav aria-label="Range" className="flex flex-wrap items-center gap-2">
        {RANGE_KEYS.map((key) => (
          <OptionLink key={key} href={leadersPath({ range: key, limit })} isSelected={key === range}>
            {RANGES[key]}
          </OptionLink>
        ))}
      </nav>
      <nav aria-label="Rows" className="flex flex-wrap items-center gap-2">
        {LIMITS.map((n) => (
          <OptionLink key={n} href={leadersPath({ range, limit: n })} isSelected={n === limit}>
            Top {n}
          </OptionLink>
        ))}
      </nav>
    </div>
  );
}
