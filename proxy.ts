import { NextResponse, type NextRequest } from "next/server";
import { GAME_PK_RE, gameExists } from "@/lib/game-pk";

export const config = { matcher: "/games/:gamePk" };

export default async function proxy(request: NextRequest) {
  const gamePk = request.nextUrl.pathname.slice("/games/".length);
  if (GAME_PK_RE.test(gamePk) && (await gameExists(Number(gamePk)))) return;
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
}
