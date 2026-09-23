import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { shiftDate } from "@/lib/dates";

export function DateNav({ date, today }: { date: string; today: string }) {
  const link = (target: string, label: string) => (
    <Link
      href={target === today ? "/" : `/?date=${target}`}
      className={buttonVariants({ variant: "neutral", size: "xs" })}
    >
      {label}
    </Link>
  );

  return (
    <nav className="flex gap-2">
      {link(shiftDate(date, -1), "← Prev")}
      {date !== today && link(today, "Today")}
      {link(shiftDate(date, 1), "Next →")}
    </nav>
  );
}
