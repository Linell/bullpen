"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyMovementPlot = dynamic(
  () => import("@/components/player/movement-plot").then((m) => m.MovementPlot),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-2">
        <Skeleton className="mx-auto aspect-square w-full max-w-md" />
        <Skeleton className="mx-auto h-4 w-2/3" />
      </div>
    ),
  },
);
