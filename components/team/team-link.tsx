import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function teamPath(teamId: number, season?: number) {
  return season === undefined ? `/teams/${teamId}` : `/teams/${teamId}/${season}`;
}

export function TeamLink({
  teamId,
  className,
  children,
}: {
  teamId: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={teamPath(teamId)} className={cn("hover:underline", className)}>
      {children}
    </Link>
  );
}
