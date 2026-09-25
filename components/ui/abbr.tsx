"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";

export function Abbr({ term, children }: { term: GlossaryTerm; children?: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<abbr tabIndex={0} />}
        className="cursor-help rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {children ?? term}
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-60 px-2 py-1 text-xs shadow-shadow">
        {GLOSSARY[term]}
      </TooltipContent>
    </Tooltip>
  );
}
