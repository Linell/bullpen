import { NextResponse, type NextRequest } from "next/server";
import { GAME_PK_RE } from "@/lib/game-pk";
import { SEASON_RE, TEAM_ID_RE } from "@/lib/team-id";

export const config = { matcher: ["/games/:gamePk", "/teams/:teamId", "/teams/:teamId/:season"] };

function isWellFormed(pathname: string) {
  const [section, id, season] = pathname.split("/").slice(1);
  if (section === "games") return GAME_PK_RE.test(id);
  return TEAM_ID_RE.test(id) && (season === undefined || SEASON_RE.test(season));
}

export default function proxy(request: NextRequest) {
  if (isWellFormed(request.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
}
