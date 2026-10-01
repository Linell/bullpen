import { PlayerLink } from "@/components/player-link";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BattingLine, BoxScore as BoxScoreData, PitchingLine, TeamBoxScore } from "@/lib/box-score";
import type { GlossaryTerm } from "@/lib/glossary";
import type { Team } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

const cell = "text-right tabular-nums";
const nameCell = "text-left font-base";

const BATTING_COLUMNS: { term: GlossaryTerm; value: (line: BattingLine) => number }[] = [
  { term: "AB", value: (l) => l.atBats },
  { term: "R", value: (l) => l.runs },
  { term: "H", value: (l) => l.hits },
  { term: "RBI", value: (l) => l.rbi },
  { term: "BB", value: (l) => l.walks },
  { term: "K", value: (l) => l.strikeouts },
];

const PITCHING_COLUMNS: { term: GlossaryTerm; value: (line: PitchingLine) => number | string }[] = [
  { term: "IP", value: (l) => l.innings },
  { term: "H", value: (l) => l.hits },
  { term: "R", value: (l) => l.runs },
  { term: "ER", value: (l) => l.earnedRuns },
  { term: "BB", value: (l) => l.walks },
  { term: "K", value: (l) => l.strikeouts },
  { term: "HR", value: (l) => l.homeRuns },
  { term: "NP", value: (l) => l.pitches },
];

function BattingTable({ team, lines, season }: { team: Team; lines: BattingLine[]; season: number }) {
  return (
    <Table>
      <TableCaption className="sr-only">{team.name} batting</TableCaption>
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead scope="col" className={nameCell}>Batters</TableHead>
          <TableHead scope="col" className={nameCell}>
            <Abbr term="Pos" />
          </TableHead>
          {BATTING_COLUMNS.map(({ term }) => (
            <TableHead key={term} scope="col" className={cell}>
              <Abbr term={term} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.player.id}>
            <TableHead scope="row" className={cn(nameCell, line.isSubstitute && "pl-5")}>
              <PlayerLink playerId={line.player.id} role="hitting" season={season}>
                {line.player.name}
              </PlayerLink>
            </TableHead>
            <TableCell className={nameCell}>{line.position}</TableCell>
            {BATTING_COLUMNS.map(({ term, value }) => (
              <TableCell key={term} className={cell}>
                {value(line)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PitchingTable({ team, lines, season }: { team: Team; lines: PitchingLine[]; season: number }) {
  return (
    <Table>
      <TableCaption className="sr-only">{team.name} pitching</TableCaption>
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead scope="col" className={nameCell}>Pitchers</TableHead>
          {PITCHING_COLUMNS.map(({ term }) => (
            <TableHead key={term} scope="col" className={cell}>
              <Abbr term={term} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.player.id}>
            <TableHead scope="row" className={nameCell}>
              <PlayerLink playerId={line.player.id} role="pitching" season={season}>
                {line.player.name}
              </PlayerLink>
              {line.decision && <span className="text-xs opacity-70"> ({line.decision})</span>}
            </TableHead>
            {PITCHING_COLUMNS.map(({ term, value }) => (
              <TableCell key={term} className={cell}>
                {value(line)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TeamBoxScoreCard({ team, season, lines }: { team: Team; season: number; lines: TeamBoxScore }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <h2>
          {team.name}
          <span className="sr-only"> box score</span>
        </h2>
        {lines.batting.length > 0 && <BattingTable team={team} lines={lines.batting} season={season} />}
        {lines.pitching.length > 0 && <PitchingTable team={team} lines={lines.pitching} season={season} />}
      </CardContent>
    </Card>
  );
}

export function BoxScore({
  away,
  home,
  season,
  boxScore,
}: {
  away: Team;
  home: Team;
  season: number;
  boxScore: BoxScoreData;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <TeamBoxScoreCard team={away} season={season} lines={boxScore.away} />
      <TeamBoxScoreCard team={home} season={season} lines={boxScore.home} />
    </div>
  );
}
