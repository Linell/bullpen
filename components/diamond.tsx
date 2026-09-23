import type { Situation } from "@/lib/scoreboard";
import { cn } from "@/lib/utils";

const BASES = [
  { x: 15, y: 9 },
  { x: 9, y: 3 },
  { x: 3, y: 9 },
];

function summary({ outs, bases }: Situation) {
  const names = ["first", "second", "third"].filter((_, i) => bases[i]);
  const runners = names.length > 0 ? `Runners on ${names.join(", ")}` : "Bases empty";
  return `${runners}, ${outs} ${outs === 1 ? "out" : "outs"}`;
}

export function Diamond({ situation }: { situation: Situation }) {
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={summary(situation)}>
      <svg viewBox="0 0 24 18" className="h-4.5 w-6" aria-hidden>
        {BASES.map(({ x, y }, i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={6}
            height={6}
            transform={`rotate(45 ${x + 3} ${y + 3})`}
            className={cn(
              "stroke-foreground stroke-[1.5]",
              situation.bases[i] ? "fill-foreground" : "fill-none",
            )}
          />
        ))}
      </svg>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full border border-foreground",
              i < situation.outs && "bg-foreground",
            )}
          />
        ))}
      </span>
    </span>
  );
}
