import type { BattedBall } from "@/lib/stats/hitting";
import { cn } from "@/lib/utils";

const RESULTS = [
  { bases: 0, label: "Out", className: "fill-foreground/15 stroke-foreground/60" },
  { bases: 1, label: "1B", className: "fill-chart-1 stroke-border" },
  { bases: 2, label: "2B", className: "fill-chart-4 stroke-border" },
  { bases: 3, label: "3B", className: "fill-chart-3 stroke-border" },
  { bases: 4, label: "HR", className: "fill-chart-2 stroke-border" },
];

const FIELD = "M125 204 L32 111 Q125 -23 218 111 Z";
const INFIELD = "M125 204 L150.5 178.5 L125 153 L99.5 178.5 Z";

function resultOf(bases: number) {
  return RESULTS[bases] ?? RESULTS[0];
}

function summary(balls: BattedBall[]) {
  const counts = RESULTS.map(({ bases, label }) => `${balls.filter((b) => b.bases === bases).length} ${label}`);
  return `Spray chart of ${balls.length} balls in play: ${counts.join(", ")}`;
}

export function SprayChart({ balls }: { balls: BattedBall[] }) {
  return (
    <figure className="flex w-full max-w-sm flex-col gap-2">
      <svg viewBox="0 0 250 215" className="w-full" role="img" aria-label={summary(balls)}>
        <path d={FIELD} className="fill-main/15 stroke-foreground/50" />
        <path d={INFIELD} className="fill-none stroke-foreground/50" />
        {balls.map((ball, i) => (
          <circle
            key={i}
            cx={ball.x}
            cy={ball.y}
            r={2.5}
            className={cn("stroke-[0.75]", resultOf(ball.bases).className)}
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {RESULTS.map(({ label, className }) => (
          <span key={label} className="flex items-center gap-1">
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
              <circle cx={5} cy={5} r={4} className={cn("stroke-1", className)} />
            </svg>
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
