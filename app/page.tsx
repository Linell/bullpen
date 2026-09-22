import Link from "next/link";
import { Scoreboard } from "@/components/scoreboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { formatOfficialDate, isOfficialDate, shiftDate, todayOfficialDate } from "@/lib/format";
import { getGames } from "@/lib/games";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { date: param } = await searchParams;
  const today = todayOfficialDate();
  const date = isOfficialDate(param) ? param : today;
  const isToday = date === today;
  const games = await getGames(date);

  const nav = (target: string, label: string) => (
    <Link
      href={target === today ? "/" : `/?date=${target}`}
      className={buttonVariants({ variant: "neutral", size: "xs" })}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="rounded-base border-2 border-border bg-main px-3 py-1 text-xl font-heading text-main-foreground shadow-shadow">
          Bullpen
        </span>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pt-6 pb-24">
        <Scoreboard
          key={date}
          date={date}
          games={games}
          // Yesterday's late games can still be running or resume.
          live={date === today || date === shiftDate(today, -1)}
          dateLabel={formatOfficialDate(date)}
          emptyLabel={isToday ? "No games today." : "No games on this date."}
          heading={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-4xl">{isToday ? "Today’s games" : "Games"}</h1>
              <nav className="flex gap-2">
                {nav(shiftDate(date, -1), "← Prev")}
                {!isToday && nav(today, "Today")}
                {nav(shiftDate(date, 1), "Next →")}
              </nav>
            </div>
          }
        />
      </main>
    </div>
  );
}
