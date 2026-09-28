import Link from "next/link";
import { SeasonKeys } from "@/components/season-keys";
import { buttonVariants } from "@/components/ui/button";

const stepClass = buttonVariants({ variant: "neutral", size: "xs" });

export function SeasonSwitcher({
  seasons,
  season,
  href,
}: {
  seasons: number[];
  season: number;
  href: (season: number) => string;
}) {
  const chronological = [...seasons].sort((a, b) => a - b);
  const index = chronological.indexOf(season);
  const older = chronological[index - 1];
  const newer = chronological[index + 1];
  const olderHref = older === undefined ? undefined : href(older);
  const newerHref = newer === undefined ? undefined : href(newer);

  return (
    <nav aria-label="Seasons" className="flex flex-wrap items-center gap-2">
      <StepLink href={olderHref} label="Previous season" shortcut="[">
        ←
      </StepLink>
      {chronological.map((s) => (
        <Link
          key={s}
          href={href(s)}
          prefetch={s === older || s === newer}
          scroll={false}
          aria-current={s === season ? "page" : undefined}
          className={buttonVariants({ variant: s === season ? "noShadow" : "neutral", size: "xs" })}
        >
          {s}
        </Link>
      ))}
      <StepLink href={newerHref} label="Next season" shortcut="]">
        →
      </StepLink>
      <SeasonKeys olderHref={olderHref} newerHref={newerHref} />
    </nav>
  );
}

function StepLink({
  href,
  label,
  shortcut,
  children,
}: {
  href?: string;
  label: string;
  shortcut: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span aria-hidden className={stepClass} data-disabled>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      title={`${label} (${shortcut})`}
      className={stepClass}
    >
      {children}
    </Link>
  );
}
