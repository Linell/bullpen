import type { ScoreUpdate } from "@/lib/inngest/realtime";

export type Team = {
  name: string;
  abbreviation: string;
  record?: string;
};

export type GameStatus =
  | { state: "scheduled"; note?: string }
  | { state: "live"; inning: string; note?: string }
  | { state: "final"; innings: number; note?: string }
  | { state: "postponed" }
  | { state: "suspended" }
  | { state: "cancelled" };

export type GameSide = {
  team: Team;
  score?: number;
};

export type Game = {
  id: string;
  gamePk: number;
  officialDate: string;
  gameNumber: number;
  postseason?: string;
  startTime: string;
  venue?: string;
  status: GameStatus;
  away: GameSide;
  home: GameSide;
  updatedAt: number;
};

export type StatusFields = Pick<
  ScoreUpdate,
  "abstractState" | "codedState" | "detailedState" | "inning" | "inningHalf"
>;

const POSTSEASON: Record<string, string> = {
  F: "Wild Card",
  D: "Division Series",
  L: "LCS",
  W: "World Series",
};

export function postseasonLabel(gameType: string) {
  return POSTSEASON[gameType];
}

const HALVES: Record<string, string> = {
  top: "Top",
  bottom: "Bot",
  middle: "Mid",
  end: "End",
};

function inningLabel(inning: number | null, half: string | null) {
  if (inning == null) return "";
  const prefix = half ? (HALVES[half.toLowerCase()] ?? half) : "";
  return `${prefix} ${inning}`.trim();
}

export function toStatus(s: StatusFields): GameStatus {
  const detailed = s.detailedState;
  switch (s.codedState) {
    case "S":
      return { state: "scheduled" };
    case "P":
      if (detailed.startsWith("Delayed")) return { state: "scheduled", note: "Delayed" };
      if (detailed === "Warmup") return { state: "scheduled", note: "Warmup" };
      return { state: "scheduled" };
    case "I":
      return {
        state: "live",
        inning: inningLabel(s.inning, s.inningHalf),
        note: detailed.startsWith("Delayed") ? "Delayed" : undefined,
      };
    case "M":
    case "N":
      return { state: "live", inning: inningLabel(s.inning, s.inningHalf), note: "Review" };
    case "F":
    case "O":
      return { state: "final", innings: s.inning ?? 9 };
    case "Q":
    case "R":
      return { state: "final", innings: s.inning ?? 9, note: "Forfeit" };
    case "D":
      return { state: "postponed" };
    case "C":
      return { state: "cancelled" };
    case "U":
      return { state: "suspended" };
    case "T":
      return s.abstractState === "Preview" ? { state: "scheduled" } : { state: "suspended" };
  }
  if (s.abstractState === "Final") return { state: "final", innings: s.inning ?? 9 };
  if (s.abstractState === "Live") return { state: "live", inning: inningLabel(s.inning, s.inningHalf) };
  return { state: "scheduled" };
}

export function showsScore(status: GameStatus) {
  return status.state === "live" || status.state === "final" || status.state === "suspended";
}

export function score(status: GameStatus, value: number | null) {
  return showsScore(status) && value != null ? value : undefined;
}

export function applyUpdate(game: Game, u: ScoreUpdate, updatedAt: number): Game {
  const status = toStatus(u);
  return {
    ...game,
    status,
    away: { ...game.away, score: score(status, u.awayScore) },
    home: { ...game.home, score: score(status, u.homeScore) },
    updatedAt,
  };
}

export type ScoreMessage = { topic?: string; data: unknown; createdAt?: Date | string };

export function mergeUpdates(games: Game[], messages: ScoreMessage[], date: string): Game[] {
  if (messages.length === 0) return games;
  const byPk = new Map(games.map((g) => [g.gamePk, g]));
  for (const message of messages) {
    if (message.topic !== "games" || !Array.isArray(message.data)) continue;
    const at = message.createdAt ? new Date(message.createdAt).getTime() : Date.now();
    for (const u of message.data as ScoreUpdate[]) {
      if (u.officialDate !== date) continue;
      const game = byPk.get(u.gamePk);
      if (!game || at < game.updatedAt) continue;
      byPk.set(u.gamePk, applyUpdate(game, u, at));
    }
  }
  return games.map((g) => byPk.get(g.gamePk) ?? g);
}
