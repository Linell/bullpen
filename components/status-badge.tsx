import { Badge } from "@/components/ui/badge";
import { formatGameTime } from "@/lib/dates";
import type { Game } from "@/lib/scoreboard";

export function StatusBadge({ game }: { game: Game }) {
  const { status } = game;

  if (status.state === "live") {
    const label = [status.note, status.inning].filter(Boolean).join(" · ");
    return <Badge variant="solid">{label || "In progress"}</Badge>;
  }

  if (status.state === "final") {
    const final = status.innings === 9 ? "Final" : `Final/${status.innings}`;
    return <Badge>{status.note ? `${final} · ${status.note}` : final}</Badge>;
  }

  if (status.state === "postponed") return <Badge variant="neutral">Postponed</Badge>;
  if (status.state === "suspended") return <Badge variant="neutral">Suspended</Badge>;
  if (status.state === "cancelled") return <Badge variant="neutral">Cancelled</Badge>;

  const time = formatGameTime(game.startTime);
  return <Badge variant="neutral">{status.note ? `${status.note} · ${time}` : time}</Badge>;
}
