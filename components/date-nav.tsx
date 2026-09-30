import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import { shiftDate } from "@/lib/dates";
import { scoresPath } from "@/lib/routes";

const linkClass = buttonVariants({ variant: "neutral", size: "xs" });

export function DateNav({ date, isToday }: { date: string; isToday: boolean }) {
  return (
    <nav className="flex flex-wrap gap-2">
      <Link href={scoresPath(shiftDate(date, -1))} prefetch className={linkClass}>
        ← Prev
      </Link>
      {!isToday && (
        <Link href="/" className={linkClass}>
          Today
        </Link>
      )}
      <DatePicker date={date} />
      <Link href={scoresPath(shiftDate(date, 1))} prefetch className={linkClass}>
        Next →
      </Link>
    </nav>
  );
}
