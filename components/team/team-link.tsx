import { IntentLink } from "@/components/intent-link";
import type { ReactNode } from "react";
import { teamPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function TeamLink({
  teamId,
  season,
  className,
  children,
}: {
  teamId: number;
  season?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <IntentLink href={teamPath(teamId, season)} className={cn("hover:underline", className)}>
      {children}
    </IntentLink>
  );
}
