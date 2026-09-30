"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyRunDiffChart = dynamic(
  () => import("@/components/team/run-diff-chart").then((m) => m.RunDiffChart),
  { ssr: false, loading: () => <Skeleton className="aspect-[3/1] w-full" /> },
);
