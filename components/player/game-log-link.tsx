import Link from "next/link";
import { formatShortDate } from "@/lib/dates";
import { gamePath } from "@/lib/routes";

export function GameLogLink({
  game,
}: {
  game: { gamePk: number; date: string; isHome: boolean; opponent: string | null };
}) {
  return (
    <Link href={gamePath(game.gamePk)} className="hover:underline">
      {formatShortDate(game.date)} {game.isHome ? "vs" : "@"} {game.opponent ?? "—"}
    </Link>
  );
}
