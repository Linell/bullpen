import type { NextRequest } from "next/server";
import { SEASON_RE, TEAM_ID_RE } from "@/lib/team-id";
import { getTeamSeasons } from "@/lib/team-summary";

export async function GET(request: NextRequest, { params }: RouteContext<"/api/teams/[teamId]/exists">) {
  const { teamId } = await params;
  const season = request.nextUrl.searchParams.get("season");
  if (!TEAM_ID_RE.test(teamId) || (season !== null && !SEASON_RE.test(season)))
    return new Response(null, { status: 404 });

  const seasons = await getTeamSeasons(Number(teamId));
  const found = season === null ? seasons.length > 0 : seasons.includes(Number(season));
  return new Response(null, { status: found ? 200 : 404 });
}
