import Link from "next/link";
import { TeamLink } from "@/components/team/team-link";
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
        "flex aspect-square items-center justify-center rounded-base border-2 border-border text-xs font-heading",
        result.won ? "bg-main text-main-foreground" : "bg-background opacity-70",
      )}
    >
      {result.won ? "W" : "L"}
    </Link>
  );
}

function FormRow({ team, form }: { team: Team; form: Form }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-12 shrink-0 flex-col">
        <TeamLink teamId={team.id} className="font-heading">
          {team.abbreviation}
        </TeamLink>
        {form.streak && <span className="text-xs tabular-nums opacity-70">{form.streak}</span>}
      </div>
      <div className="grid max-w-80 flex-1 grid-cols-10 gap-1">
        {form.results.toReversed().map((r) => (
          <ResultPip key={r.gamePk} result={r} />
        ))}
      </div>
    </div>
  );
}

function seriesSummary(away: Team, home: Team, { awayWins, homeWins }: SeriesRecord) {
  if (awayWins === homeWins) return `Series tied ${awayWins}–${homeWins}`;
  const [leader, high, low] =
    awayWins > homeWins ? [away, awayWins, homeWins] : [home, homeWins, awayWins];
  return `${leader.abbreviation} leads ${high}–${low}`;
}

function SeasonSeries({ away, results }: { away: Team; results: TeamResult[] }) {
  return (
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
  );
}

export function Matchup({
  away,
  home,
  awayForm,
  homeForm,
  headToHead,
}: {
  away: Team;
  home: Team;
  awayForm: Form;
  homeForm: Form;
  headToHead: { record: SeriesRecord; results: TeamResult[] };
}) {
  const hasForm = awayForm.results.length > 0 || homeForm.results.length > 0;
  const hasSeries = headToHead.results.length > 0;
  if (!hasForm && !hasSeries) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {hasForm && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg">Last 10</h2>
            <FormRow team={away} form={awayForm} />
            <FormRow team={home} form={homeForm} />
          </section>
        )}
        {hasSeries && (
          <section
            className={cn("flex flex-col gap-3", hasForm && "border-t-2 border-border pt-4")}
          >
            <h2 className="flex items-baseline justify-between gap-2 text-lg">
              Season series
              <span className="text-sm opacity-70">
                {seriesSummary(away, home, headToHead.record)}
              </span>
            </h2>
            <SeasonSeries away={away} results={headToHead.results} />
          </section>
        )}
      </CardContent>
    </Card>
  );
}
