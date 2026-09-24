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
