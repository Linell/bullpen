"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Pop({ value, className, children }: { value: unknown; className?: string; children: ReactNode }) {
  const [initial] = useState(value);

  return (
    <span key={String(value)} className={cn("inline-block", value !== initial && "motion-safe:animate-pop", className)}>
      {children}
    </span>
  );
}
