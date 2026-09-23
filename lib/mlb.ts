import { RetryAfterError } from "inngest";

const GAME_TYPES = ["R", "F", "D", "L", "W"];

const BASE_URL = "https://statsapi.mlb.com";
const HEADERS = {
  "User-Agent": "bullpen/0.1 (personal, non-commercial)",
  Accept: "application/json",
};

const SCHEDULE_FIELDS = [
  "dates", "date", "games", "gamePk", "gameType", "season", "gameDate", "officialDate",
  "gameNumber", "status", "abstractGameState", "codedGameState", "detailedState",
  "teams", "home", "away", "team", "id", "name", "teamName", "abbreviation",
  "leagueRecord", "wins", "losses", "score", "linescore", "currentInning", "inningHalf",
  "runs", "venue",
].join(",");

type Side = {
  team: { id: number; name?: string; teamName?: string; abbreviation?: string };
  leagueRecord?: { wins: number; losses: number };
  score?: number;
};

export type ScheduleGame = {
  gamePk: number;
  gameType: string;
  season: string;
  gameDate: string;
  officialDate: string;
  gameNumber: number;
  status: { abstractGameState: string; codedGameState: string; detailedState: string };
  teams: { home: Side; away: Side };
  linescore?: {
    currentInning?: number;
    inningHalf?: string;
    teams?: { home?: { runs?: number }; away?: { runs?: number } };
  };
  venue?: { id: number; name?: string };
};

export type ScheduleResponse = {
  dates: { date: string; games: ScheduleGame[] }[];
};

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const when = Number.isFinite(seconds) ? seconds * 1000 : new Date(retryAfter);
      throw new RetryAfterError(`MLB Stats API rate limited ${url}`, when);
    }
  }
  if (!res.ok) throw new Error(`MLB Stats API ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export function fetchSchedule({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}): Promise<ScheduleResponse> {
  return get<ScheduleResponse>("/api/v1/schedule", {
    sportId: "1",
    startDate,
    endDate,
    gameType: GAME_TYPES.join(","),
    hydrate: "linescore,team",
    fields: SCHEDULE_FIELDS,
  });
}

type SeasonResponse = {
  seasons: {
    regularSeasonStartDate: string;
    regularSeasonEndDate: string;
    postSeasonEndDate?: string;
  }[];
};

export async function fetchSeasonDates(
  season: number,
): Promise<{ startDate: string; endDate: string }> {
  const json = await get<SeasonResponse>(`/api/v1/seasons/${season}`, { sportId: "1" });
  const s = json.seasons[0];
  if (!s) throw new Error(`MLB season ${season} not found`);
  return {
    startDate: s.regularSeasonStartDate,
    endDate: s.postSeasonEndDate ?? s.regularSeasonEndDate,
  };
}

export function fetchFeed(gamePk: number): Promise<unknown> {
  return get<unknown>(`/api/v1.1/game/${gamePk}/feed/live`);
}
