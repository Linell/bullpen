import { PlayerLink } from "@/components/player-link";
import { formatPitcherLine, type GameSide } from "@/lib/scoreboard";

export function Probable({ side, season }: { side: GameSide; season: number }) {
  if (!side.probable) return "TBD";
  return (
    <>
      <PlayerLink playerId={side.probable.id} role="pitching" season={season} className="relative z-10">
        {side.probable.name}
      </PlayerLink>
      {side.probableLine && <span className="tabular-nums"> ({formatPitcherLine(side.probableLine)})</span>}
    </>
  );
}
