import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { diffFeeds, patchGame, type LiveGame } from "@/lib/live-game";
import type { Game } from "@/lib/scoreboard";

const final = JSON.parse(
  gunzipSync(readFileSync(path.join(import.meta.dirname, "fixtures/feeds/824787.json.gz"))).toString("utf8"),
);

function midGame() {
  const feed = structuredClone(final);
  feed.metaData.timeStamp = "20260922_010000";
  feed.gameData.status = { abstractGameState: "Live", codedGameState: "I", detailedState: "In Progress" };
  feed.liveData.plays.allPlays = feed.liveData.plays.allPlays.slice(0, 10);
  feed.liveData.plays.allPlays[9].result.description = "Pending";
  feed.liveData.linescore.outs = 1;
  return feed;
}

describe("diffFeeds", () => {
  it("sends every finished play and the game state for a first feed", () => {
    const { game, plays } = diffFeeds(null, final);

    expect(plays).toHaveLength(final.liveData.plays.allPlays.length);
    expect(game).toMatchObject({
      gamePk: 824787,
      status: { state: "final", innings: 9 },
      completed: true,
      awayScore: 3,
      homeScore: 4,
    });
    expect(game?.linescore).toContainEqual({ inning: 9, half: "top", runs: 0, hits: 0, errors: 0 });
    expect(game?.linescore).toContainEqual({ inning: 9, half: "bottom", runs: null, hits: 0, errors: 0 });
  });

  it("sends only new or changed plays", () => {
    const { plays } = diffFeeds(midGame(), final);

    expect(plays.map((play) => play.atBatIndex)).toEqual(
      final.liveData.plays.allPlays.slice(9).map((play: { atBatIndex: number }) => play.atBatIndex),
    );
    expect(plays[0]).toMatchObject({ atBatIndex: 9, description: final.liveData.plays.allPlays[9].result.description });
  });

  it("skips unfinished plays", () => {
    const feed = midGame();
    feed.liveData.plays.allPlays[9].about.isComplete = false;

    expect(diffFeeds(null, feed).plays).toHaveLength(9);
  });

  it("leaves out the game state when only the timestamp changed", () => {
    const newer = structuredClone(final);
    newer.metaData.timeStamp = "20260922_020000";

    expect(diffFeeds(final, newer)).toEqual({ game: undefined, plays: [] });
  });

  it("sends the game state when the situation changed", () => {
    const after = midGame();
    after.liveData.linescore.outs = 2;

    expect(diffFeeds(midGame(), after).game?.status).toMatchObject({ state: "live", situation: { outs: 2 } });
  });
});

describe("patchGame", () => {
  const game = {
    gamePk: 1,
    status: { state: "scheduled" },
    completed: false,
    away: { team: { id: 1, name: "A", abbreviation: "A" } },
    home: { team: { id: 2, name: "B", abbreviation: "B" } },
  } as Game;

  const live: LiveGame = {
    gamePk: 1,
    status: { state: "live", inning: "Top 1" },
    completed: false,
    awayScore: 1,
    homeScore: 0,
    linescore: [],
  };

  it("applies the latest push over the rendered game", () => {
    expect(patchGame(game, live)).toMatchObject({ status: live.status, away: { score: 1 }, home: { score: 0 } });
  });

  it("keeps the rendered game without a push", () => {
    expect(patchGame(game, undefined)).toBe(game);
  });
});
