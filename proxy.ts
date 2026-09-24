import { NextResponse, type NextRequest } from "next/server";
import { GAME_PK_RE } from "@/lib/game-pk";

export const config = { matcher: "/games/:gamePk" };

export default async function proxy(request: NextRequest) {
  const gamePk = request.nextUrl.pathname.slice("/games/".length);
  if (!GAME_PK_RE.test(gamePk)) return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });

  try {
    const res = await fetch(`${request.nextUrl.origin}/api/games/${gamePk}/exists`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.status === 404) return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  } catch {}

  return NextResponse.next();
}
