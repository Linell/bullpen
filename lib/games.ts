import { connection } from "next/server";

export type Team = {
  name: string;
  abbreviation: string;
  record: string;
};

export type GameStatus =
  | { state: "scheduled" }
  | { state: "live"; inning: string }
  | { state: "final"; innings: number };

export type GameSide = {
  team: Team;
  score?: number;
};

export type Game = {
  id: string;
  startTime: string;
  venue: string;
  status: GameStatus;
  away: GameSide;
  home: GameSide;
};

// Today's date in UTC with the given time, as an ISO string. Mock data only.
function today(hours: number, minutes: number) {
  const date = new Date();
  date.setUTCHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// Placeholder until we wire up a real schedule source (e.g. the MLB Stats API).
export async function getTodaysGames(): Promise<Game[]> {
  await connection();

  const games: Game[] = [
    {
      id: "1",
      startTime: today(17, 10),
      venue: "Wrigley Field",
      status: { state: "final", innings: 9 },
      away: { team: { name: "Brewers", abbreviation: "MIL", record: "88-66" }, score: 3 },
      home: { team: { name: "Cubs", abbreviation: "CHC", record: "85-69" }, score: 5 },
    },
    {
      id: "2",
      startTime: today(20, 5),
      venue: "Fenway Park",
      status: { state: "final", innings: 10 },
      away: { team: { name: "Yankees", abbreviation: "NYY", record: "90-64" }, score: 7 },
      home: { team: { name: "Red Sox", abbreviation: "BOS", record: "80-74" }, score: 6 },
    },
    {
      id: "3",
      startTime: today(23, 10),
      venue: "Truist Park",
      status: { state: "live", inning: "Bot 6" },
      away: { team: { name: "Phillies", abbreviation: "PHI", record: "92-62" }, score: 2 },
      home: { team: { name: "Braves", abbreviation: "ATL", record: "84-70" }, score: 2 },
    },
    {
      id: "4",
      startTime: today(23, 40),
      venue: "Minute Maid Park",
      status: { state: "live", inning: "Top 4" },
      away: { team: { name: "Mariners", abbreviation: "SEA", record: "83-71" }, score: 1 },
      home: { team: { name: "Astros", abbreviation: "HOU", record: "82-72" }, score: 0 },
    },
    {
      id: "5",
      startTime: today(2, 10),
      venue: "Dodger Stadium",
      status: { state: "scheduled" },
      away: { team: { name: "Giants", abbreviation: "SF", record: "76-78" } },
      home: { team: { name: "Dodgers", abbreviation: "LAD", record: "93-61" } },
    },
    {
      id: "6",
      startTime: today(2, 40),
      venue: "Petco Park",
      status: { state: "scheduled" },
      away: { team: { name: "Diamondbacks", abbreviation: "AZ", record: "79-75" } },
      home: { team: { name: "Padres", abbreviation: "SD", record: "87-67" } },
    },
  ];

  return games;
}
