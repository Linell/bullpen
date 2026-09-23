import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link
        href="/"
        className="rounded-base border-2 border-border bg-main px-3 py-1 text-xl font-heading text-main-foreground shadow-shadow"
      >
        Bullpen
      </Link>
      <ThemeToggle />
    </header>
  );
}
