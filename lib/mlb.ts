import { RetryAfterError } from "inngest";
import { DEFAULT_GAME_TYPES } from "@/lib/inngest/events";

// MLB's unofficial Stats API. Personal, non-commercial use only; fetch politely.
const BASE_URL = "https://statsapi.mlb.com";
const HEADERS = {
  "User-Agent": "bullpen/0.1 (personal, non-commercial)",
  "Accept-Encoding": "gzip",
  Accept: "application/json",
};

// `fields` filters by key name at any depth, so this keeps the payload to what
// parseSchedule reads (about a fifth of the gzipped size). `hydrate=team` adds
// abbreviation and teamName; `id`/`name` also keep venue.id and venue.name.
export const SCHEDULE_FIELDS = [
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
  gameDate: string; // UTC
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

export type SeasonDates = { startDate: string; endDate: string };

export class MlbHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`MLB Stats API ${status} for ${url}`);
    this.name = "MlbHttpError";
  }
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      // Retry-After is either delta-seconds or an HTTP date.
      const when = Number.isFinite(seconds) ? seconds * 1000 : new Date(retryAfter);
      throw new RetryAfterError(`MLB Stats API rate limited ${url}`, when);
    }
  }
  if (!res.ok) throw new MlbHttpError(res.status, url.toString());
  return (await res.json()) as T;
}

// Every game between two dates (YYYY-MM-DD, inclusive). gameType takes a comma list.
export function fetchSchedule({
  startDate,
  endDate,
  gameTypes = DEFAULT_GAME_TYPES,
}: {
  startDate: string;
  endDate: string;
  gameTypes?: readonly string[];
}): Promise<ScheduleResponse> {
  return get<ScheduleResponse>("/api/v1/schedule", {
    sportId: "1",
    startDate,
    endDate,
    gameType: gameTypes.join(","),
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

// Regular season start through postseason end (or regular season end if unset).
export async function fetchSeasonDates(season: number): Promise<SeasonDates> {
  const json = await get<SeasonResponse>(`/api/v1/seasons/${season}`, { sportId: "1" });
  const s = json.seasons[0];
  if (!s) throw new Error(`MLB season ${season} not found`);
  return {
    startDate: s.regularSeasonStartDate,
    endDate: s.postSeasonEndDate ?? s.regularSeasonEndDate,
  };
}

// Full live feed (about 670 KB). Callers own its shape.
export function fetchFeed(gamePk: number): Promise<unknown> {
  return get<unknown>(`/api/v1.1/game/${gamePk}/feed/live`);
}
