import { Suspense, type ComponentProps } from "react";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { leadersPath, standingsPath } from "@/lib/routes";

const navLinkClass = buttonVariants({ variant: "neutral", size: "xs" });

// usePathname suspends on unknown dynamic params, so prerender a plain link
function PrimaryLink(props: ComponentProps<typeof NavLink>) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <NavLink {...props} />
    </Suspense>
  );
}

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center justify-between px-6 py-6">
      <nav aria-label="Primary" className="flex items-center gap-4">
        <Link
          href="/"
          className="rounded-base border-2 border-border bg-main px-3 py-1 text-xl font-heading text-main-foreground shadow-shadow"
        >
          Bullpen
        </Link>
        <PrimaryLink href={standingsPath()} className={navLinkClass}>
          Standings
        </PrimaryLink>
        <PrimaryLink href={leadersPath()} prefetch className={navLinkClass}>
          Leaders
        </PrimaryLink>
      </nav>
      <ThemeToggle />
    </header>
  );
}
