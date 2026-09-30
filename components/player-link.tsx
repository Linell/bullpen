import { IntentLink } from "@/components/intent-link";
import type { ReactNode } from "react";
import { playerPath, type PlayerRole } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function PlayerLink({
  playerId,
  role,
  season,
  className,
  children,
}: {
  playerId: number;
  role?: PlayerRole;
  season?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <IntentLink href={playerPath(playerId, { role, season })} className={cn("hover:underline", className)}>
      {children}
    </IntentLink>
  );
}
