import type { LinescoreRow } from "@/lib/linescore";
import type { Half } from "@/lib/play-by-play";
import { isCompleted } from "@/lib/schedule";
import { score, toStatus, type AtBat, type Game, type GameStatus } from "@/lib/scoreboard";

export type LiveGame = {
  gamePk: number;
  status: GameStatus;
  completed: boolean;
  atBat?: AtBat;
  awayScore?: number;
  homeScore?: number;
  linescore: LinescoreRow[];
};

export type LivePlay = {
  atBatIndex: number;
  inning: number;
  half: Half;
  event: string | null;
  description: string;
  awayScore: number;
  homeScore: number;
  isScoringPlay: boolean;
};

export type LivePlays = { gamePk: number; plays: LivePlay[] };

export type FeedDiff = { game?: LiveGame; plays: LivePlay[] };

type Person = { id: number; fullName: string };

type Runs = { runs?: number; hits?: number; errors?: number };

type Feed = {
  gamePk: number;
  gameData: { status: { abstractGameState: string; codedGameState: string; detailedState: string } };
  liveData: {
    linescore?: {
      currentInning?: number;
      inningHalf?: string;
      outs?: number;
      balls?: number;
      strikes?: number;
      offense?: { first?: unknown; second?: unknown; third?: unknown; batter?: Person };
      defense?: { pitcher?: Person };
      teams?: { home?: Runs; away?: Runs };
      innings?: { num: number; away?: Runs; home?: Runs }[];
    };
    plays?: { allPlays?: FeedPlay[] };
  };
};

type FeedPlay = {
  result: { event?: string; description?: string; awayScore: number; homeScore: number };
  about: { atBatIndex: number; inning: number; halfInning: Half; isComplete: boolean; isScoringPlay?: boolean };
};

function linescoreRows(feed: Feed): LinescoreRow[] {
  const line = (inning: number, half: Half, runs: Runs) => ({
    inning,
    half,
    runs: runs.runs ?? null,
    hits: runs.hits ?? null,
    errors: runs.errors ?? null,
  });
  return (feed.liveData.linescore?.innings ?? []).flatMap((inning) => [
    ...(inning.away ? [line(inning.num, "top", inning.away)] : []),
    ...(inning.home ? [line(inning.num, "bottom", inning.home)] : []),
  ]);
}

function atBat(feed: Feed): AtBat | undefined {
  const ls = feed.liveData.linescore;
  if (ls?.balls == null || ls.strikes == null) return undefined;
  const person = (p?: Person) => p && { id: p.id, name: p.fullName };
  return {
    balls: ls.balls,
    strikes: ls.strikes,
    batter: person(ls.offense?.batter),
    pitcher: person(ls.defense?.pitcher),
  };
}

function gameState(feed: Feed): LiveGame {
  const ls = feed.liveData.linescore;
  const { abstractGameState, codedGameState, detailedState } = feed.gameData.status;
  const status = toStatus({
    abstractState: abstractGameState,
    codedState: codedGameState,
    detailedState,
    inning: ls?.currentInning ?? null,
    inningHalf: ls?.inningHalf ?? null,
    outs: ls?.outs ?? null,
    bases: [ls?.offense?.first != null, ls?.offense?.second != null, ls?.offense?.third != null],
  });
  return {
    gamePk: feed.gamePk,
    status,
    completed: isCompleted(codedGameState),
    atBat: atBat(feed),
    awayScore: score(status, ls?.teams?.away?.runs ?? null),
    homeScore: score(status, ls?.teams?.home?.runs ?? null),
    linescore: linescoreRows(feed),
  };
}

function finishedPlays(feed: Feed): LivePlay[] {
  return (feed.liveData.plays?.allPlays ?? [])
    .filter((play) => play.about.isComplete && play.result.description)
    .map(({ result, about }) => ({
      atBatIndex: about.atBatIndex,
      inning: about.inning,
      half: about.halfInning,
      event: result.event ?? null,
      description: result.description ?? "",
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      isScoringPlay: about.isScoringPlay ?? false,
    }));
}

export function diffFeeds(previousFeed: unknown, nextFeed: unknown): FeedDiff {
  const previous = previousFeed as Feed | null;
  const next = nextFeed as Feed;

  const game = gameState(next);
  const gameChanged = !previous || JSON.stringify(gameState(previous)) !== JSON.stringify(game);

  const before = new Map((previous ? finishedPlays(previous) : []).map((play) => [play.atBatIndex, JSON.stringify(play)]));
  const plays = finishedPlays(next).filter((play) => before.get(play.atBatIndex) !== JSON.stringify(play));

  return {
    game: gameChanged ? game : undefined,
    plays,
  };
}

export function patchGame(game: Game, live: LiveGame | undefined): Game {
  if (!live) return game;
  return {
    ...game,
    status: live.status,
    completed: live.completed,
    atBat: live.atBat,
    away: { ...game.away, score: live.awayScore },
    home: { ...game.home, score: live.homeScore },
  };
}
