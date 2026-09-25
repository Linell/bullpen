import { NextResponse, type NextRequest } from "next/server";
import { GAME_PK_RE } from "@/lib/game-pk";
import { SEASON_RE, TEAM_ID_RE } from "@/lib/team-id";

export const config = { matcher: ["/games/:gamePk", "/teams/:teamId", "/teams/:teamId/:season"] };

function existsPath(pathname: string) {
  const [section, id, season] = pathname.split("/").slice(1);
  if (section === "games") return GAME_PK_RE.test(id) ? `/api/games/${id}/exists` : undefined;
  if (!TEAM_ID_RE.test(id)) return undefined;
  if (season === undefined) return `/api/teams/${id}/exists`;
  return SEASON_RE.test(season) ? `/api/teams/${id}/exists?season=${season}` : undefined;
}

export default async function proxy(request: NextRequest) {
  const notFound = () => NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  const path = existsPath(request.nextUrl.pathname);
  if (!path) return notFound();

  try {
    const res = await fetch(`${request.nextUrl.origin}${path}`, { signal: AbortSignal.timeout(1500) });
    if (res.status === 404) return notFound();
  } catch {}

  return NextResponse.next();
}
