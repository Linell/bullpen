import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { leadersPath } from "@/lib/routes";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-(--breakpoint-2xl) items-center justify-between px-6 py-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="rounded-base border-2 border-border bg-main px-3 py-1 text-xl font-heading text-main-foreground shadow-shadow"
        >
          Bullpen
        </Link>
        <Link href={leadersPath()} className={buttonVariants({ variant: "neutral", size: "xs" })}>
          Leaders
        </Link>
      </div>
      <ThemeToggle />
    </header>
  );
}
