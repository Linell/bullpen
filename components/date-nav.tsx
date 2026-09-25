import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { shiftDate } from "@/lib/dates";

const linkClass = buttonVariants({ variant: "neutral", size: "xs" });

export function DateNav({ date, isToday }: { date: string; isToday: boolean }) {
  return (
    <nav className="flex gap-2">
      <Link href={`/scores/${shiftDate(date, -1)}`} prefetch className={linkClass}>
        ← Prev
      </Link>
      {!isToday && (
        <Link href="/" className={linkClass}>
          Today
        </Link>
      )}
      <Link href={`/scores/${shiftDate(date, 1)}`} prefetch className={linkClass}>
        Next →
      </Link>
    </nav>
  );
}
