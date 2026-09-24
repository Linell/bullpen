import { GAME_PK_RE } from "@/lib/game-pk";
import { gameExists } from "@/lib/games";

export async function GET(_request: Request, { params }: RouteContext<"/api/games/[gamePk]/exists">) {
  const { gamePk } = await params;
  if (!GAME_PK_RE.test(gamePk) || !(await gameExists(Number(gamePk))))
    return new Response(null, { status: 404 });
  return new Response(null, { status: 200 });
}
