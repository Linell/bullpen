"use client";

import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { scoresPath } from "@/lib/routes";

const inputClass = buttonVariants({ variant: "neutral", size: "xs" });

export function DatePicker({ date }: { date: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      aria-label="Jump to date"
      value={date}
      onChange={(event) => event.target.value && router.push(scoresPath(event.target.value))}
      className={`${inputClass} min-w-0 cursor-pointer`}
    />
  );
}
