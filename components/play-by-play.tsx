import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { PlayerLink } from "@/components/player-link";
import { StrikeZone } from "@/components/strike-zone";
import { Abbr } from "@/components/ui/abbr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  halfInningLabel,
  type HalfInning,
  type Pitch,
  type PitchResult,
  type PitchingChange,
  type PlateAppearance,
  type Step,
} from "@/lib/play-by-play";
import type { Team } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

const RESULT_BG: Record<PitchResult, string> = {
  ball: "bg-chart-4",
  strike: "bg-chart-2",
  in_play: "bg-chart-1",
};

function PitchDot({ pitch }: { pitch: Pitch }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2 border-border font-heading text-[11px] text-main-foreground", RESULT_BG[pitch.result])}
    >
      {pitch.number}
    </span>
  );
}

function PitchItem({ pitch }: { pitch: Pitch }) {
  return (
    <li className="flex items-start gap-2">
      <PitchDot pitch={pitch} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-heading">{pitch.count}</span>
        <span>{pitch.type ?? "Unknown pitch"}</span>
        {pitch.speed != null && <span className="opacity-70">{`${pitch.speed.toFixed(1)} mph`}</span>}
        <span className="opacity-70">{pitch.call}</span>
        {pitch.abs && <Badge variant="neutral">
            <Abbr term="ABS" /> {pitch.abs}
          </Badge>}
      </div>
    </li>
  );
}

function StepItem({ step }: { step: Step }) {
  if (step.kind === "pitch") return <PitchItem pitch={step} />;
  return <li className="pl-7 italic opacity-70">{step.description}</li>;
}

type Sides = { away: Team; home: Team; season: number };

function Summary({ pa, away, home, season }: Sides & { pa: PlateAppearance }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs opacity-70">
        <PlayerLink playerId={pa.batter.id} role="hitting" season={season}>
          {pa.batter.name}
        </PlayerLink>{" "}
        vs.{" "}
        <PlayerLink playerId={pa.pitcher.id} role="pitching" season={season}>
          {pa.pitcher.name}
        </PlayerLink>
      </span>
      <span className="text-sm">{pa.description}</span>
      {pa.score && (
        <Badge>
          {away.abbreviation} {pa.score.away}, {home.abbreviation} {pa.score.home}
        </Badge>
      )}
    </div>
  );
}

function PitchingChangeItem({ change, season }: { change: PitchingChange; season: number }) {
  return (
    <li className="flex items-center gap-2 border-t-2 border-border py-1.5 text-xs opacity-70 first:border-t-0">
      <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden />
      <span>
        <PlayerLink playerId={change.incoming.id} role="pitching" season={season}>
          {change.incoming.name}
        </PlayerLink>{" "}
        replaces{" "}
        <PlayerLink playerId={change.outgoing.id} role="pitching" season={season}>
          {change.outgoing.name}
        </PlayerLink>
      </span>
    </li>
  );
}

function PlateAppearanceItem({ pa, away, home, season }: Sides & { pa: PlateAppearance }) {
  const pitches = pa.steps.filter((step) => step.kind === "pitch");

  if (pa.steps.length === 0) {
    return (
      <li className="border-t-2 border-border py-3 first:border-t-0">
        <Summary pa={pa} away={away} home={home} season={season} />
      </li>
    );
  }

  return (
    <li className="border-t-2 border-border first:border-t-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <Summary pa={pa} away={away} home={home} season={season} />
          <ChevronDown className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex items-start gap-4 pb-4">
          {pitches.length > 0 && <StrikeZone pitches={pitches} />}
          <ol className="flex min-w-0 flex-1 flex-col gap-2 text-xs tabular-nums">
            {pa.steps.map((step) => (
              <StepItem key={`${step.kind}-${step.index}`} step={step} />
            ))}
          </ol>
        </div>
      </details>
    </li>
  );
}

export function PlayByPlay({
  halfInnings,
  away,
  home,
  season,
}: Sides & { halfInnings: HalfInning[] }) {
  return (
    <section className="flex flex-col gap-6">
      {halfInnings.map((h) => (
        <Card key={`${h.inning}-${h.half}`} size="sm">
          <CardContent className="flex flex-col gap-3">
            <h2 className="flex items-baseline justify-between gap-2">
              {halfInningLabel(h.inning, h.half)}
              <span className="truncate text-sm font-base opacity-70">
                {(h.half === "top" ? away : home).name}
              </span>
            </h2>
            <ol>
              {h.plateAppearances.map((pa) => (
                <Fragment key={pa.atBatIndex}>
                  {pa.pitchingChange && <PitchingChangeItem change={pa.pitchingChange} season={season} />}
                  <PlateAppearanceItem pa={pa} away={away} home={home} season={season} />
                </Fragment>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
