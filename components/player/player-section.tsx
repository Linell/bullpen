import { Suspense, type ReactNode } from "react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";

export function PlayerSection({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger heading="h2">{title}</AccordionTrigger>
      <AccordionContent>
        <Suspense fallback={<Skeleton className="h-32" />}>{children}</Suspense>
      </AccordionContent>
    </AccordionItem>
  );
}
