"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { playerPath, type PlayerRole } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ROLES: { role: PlayerRole; label: string }[] = [
  { role: "hitting", label: "Hitting" },
  { role: "pitching", label: "Pitching" },
];

export function RoleTabs({ playerId, seasons }: { playerId: number; seasons: Record<PlayerRole, number[]> }) {
  const [activeRole, seasonSegment] = useSelectedLayoutSegments();
  const tabs = ROLES.filter(({ role }) => seasons[role].length > 0);
  if (tabs.length < 2) return null;

  const activeSeasons = seasons[activeRole as PlayerRole] ?? [];
  const currentSeason = seasonSegment ? Number(seasonSegment) : Math.max(...activeSeasons);

  function tabHref(role: PlayerRole) {
    const roleSeasons = seasons[role];
    const keepSeason = roleSeasons.includes(currentSeason) && currentSeason !== Math.max(...roleSeasons);
    return playerPath(playerId, { role, season: keepSeason ? currentSeason : undefined });
  }

  return (
    <nav aria-label="Role" className="flex overflow-hidden rounded-base border-2 border-border shadow-shadow">
      {tabs.map(({ role, label }) => (
        <Link
          key={role}
          href={tabHref(role)}
          aria-current={role === activeRole ? "page" : undefined}
          className={cn(
            "px-3 py-1.5 text-sm font-heading not-first:border-l-2 not-first:border-border",
            role === activeRole ? "bg-main text-main-foreground" : "bg-secondary-background hover:bg-main/30",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
