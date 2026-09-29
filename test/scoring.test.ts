import { describe, expect, it } from "vitest";
import type { LivePlay } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";
import { currentRuns, scoringSide } from "@/lib/scoring";

const game = { away: { score: 1 }, home: { score: 2 } } as Game;

const play = (awayScore: number, homeScore: number) => ({ awayScore, homeScore }) as LivePlay;

describe("currentRuns", () => {
  it("reads the game score", () => {
    expect(currentRuns(game)).toEqual({ away: 1, home: 2 });
  });

  it("takes a scoring play that lands before the score update", () => {
    expect(currentRuns(game, play(3, 2))).toEqual({ away: 3, home: 2 });
  });

  it("ignores a stale play", () => {
    expect(currentRuns(game, play(0, 0))).toEqual({ away: 1, home: 2 });
  });

  it("treats a game without a score as scoreless", () => {
    expect(currentRuns({ away: {}, home: {} } as Game)).toEqual({ away: 0, home: 0 });
  });
});

describe("scoringSide", () => {
  it("names the side whose runs went up", () => {
    expect(scoringSide({ away: 1, home: 2 }, { away: 2, home: 2 })).toBe("away");
    expect(scoringSide({ away: 1, home: 2 }, { away: 1, home: 4 })).toBe("home");
  });

  it("is undefined when nobody scored", () => {
    expect(scoringSide({ away: 1, home: 2 }, { away: 1, home: 2 })).toBeUndefined();
  });
});
