"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";

export function Abbr({ term, children }: { term: GlossaryTerm; children?: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<abbr tabIndex={0} />}
        className="cursor-help rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {children ?? term}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="max-w-60 rounded-base border-2 border-border bg-secondary-background px-2 py-1 text-xs font-base text-foreground shadow-shadow">
            {GLOSSARY[term]}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
