import { readRows } from "@/lib/db";

export const GAMES_TAG = "games";

export function dayTag(date: string) {
  return `day:${date}`;
}

export function gameTag(gamePk: number) {
  return `game:${gamePk}`;
}

export function teamTag(teamId: number) {
  return `team:${teamId}`;
}

type GameTagRow = {
  game_pk: number;
  official_date: string;
  home_team_id: number;
  away_team_id: number;
};

export async function gameCacheTags(gamePks: number[]) {
  const rows = await readRows<GameTagRow>(
    `SELECT game_pk, strftime(official_date, '%Y-%m-%d') AS official_date, home_team_id, away_team_id
     FROM games WHERE game_pk IN (${gamePks.join(",")})`,
    {},
  );
  const tags = new Set<string>();
  for (const row of rows) {
    tags.add(gameTag(row.game_pk));
    tags.add(dayTag(row.official_date));
    tags.add(teamTag(row.home_team_id));
    tags.add(teamTag(row.away_team_id));
  }
  return [...tags];
}
