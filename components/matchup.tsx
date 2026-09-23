import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatShortDate } from "@/lib/dates";
import type { Form, SeriesRecord, TeamResult } from "@/lib/matchup";
import type { Team } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

function resultLabel(r: TeamResult) {
  return `${r.won ? "W" : "L"} ${r.runsFor}–${r.runsAgainst} ${r.home ? "vs" : "@"} ${r.opponent}`;
}

function ResultPip({ result }: { result: TeamResult }) {
  return (
    <Link
      href={`/games/${result.gamePk}`}
      title={`${formatShortDate(result.officialDate)} · ${resultLabel(result)}`}
      className={cn(
        "flex size-7 items-center justify-center rounded-base border-2 border-border text-xs font-heading",
        result.won ? "bg-main text-main-foreground" : "bg-background opacity-70",
      )}
    >
      {result.won ? "W" : "L"}
    </Link>
  );
}

function FormRow({ team, form }: { team: Team; form: Form }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-12 font-heading">{team.abbreviation}</span>
      <div className="flex flex-row-reverse gap-1">
        {form.results.map((r) => (
          <ResultPip key={r.gamePk} result={r} />
        ))}
      </div>
      {form.streak && <span className="text-sm tabular-nums opacity-70">{form.streak}</span>}
    </div>
  );
}

export function RecentForm({
  away,
  home,
  awayForm,
  homeForm,
}: {
  away: Team;
  home: Team;
  awayForm: Form;
  homeForm: Form;
}) {
  if (awayForm.results.length === 0 && homeForm.results.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg">Last 10</h2>
        <FormRow team={away} form={awayForm} />
        <FormRow team={home} form={homeForm} />
      </CardContent>
    </Card>
  );
}

function seriesSummary(away: Team, home: Team, { awayWins, homeWins }: SeriesRecord) {
  if (awayWins === homeWins) return `Series tied ${awayWins}–${homeWins}`;
  const [leader, high, low] =
    awayWins > homeWins ? [away, awayWins, homeWins] : [home, homeWins, awayWins];
  return `${leader.abbreviation} leads ${high}–${low}`;
}

export function HeadToHead({
  away,
  home,
  record,
  results,
}: {
  away: Team;
  home: Team;
  record: SeriesRecord;
  results: TeamResult[];
}) {
  if (results.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="flex items-baseline justify-between gap-2 text-lg">
          Season series
          <span className="text-sm opacity-70">{seriesSummary(away, home, record)}</span>
        </h2>
        <ul className="flex flex-col text-sm">
          {results.map((r) => (
            <li key={r.gamePk} className="border-t-2 border-border first:border-t-0">
              <Link
                href={`/games/${r.gamePk}`}
                className="flex justify-between gap-2 py-1.5 hover:underline"
              >
                <span className="opacity-70">{formatShortDate(r.officialDate)}</span>
                <span className="tabular-nums">
                  {away.abbreviation} {resultLabel(r)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
