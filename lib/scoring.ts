import type { LivePlay } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";

export type Runs = { away: number; home: number };

export type ScoringSide = "away" | "home";

export function currentRuns(game: Game, latestPlay?: LivePlay): Runs {
  return {
    away: Math.max(game.away.score ?? 0, latestPlay?.awayScore ?? 0),
    home: Math.max(game.home.score ?? 0, latestPlay?.homeScore ?? 0),
  };
}

export function scoringSide(previous: Runs, next: Runs): ScoringSide | undefined {
  if (next.away > previous.away) return "away";
  if (next.home > previous.home) return "home";
  return undefined;
}
