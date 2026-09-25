import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-base bg-foreground/10", className)} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className={cn("h-32", className)} />
      </CardContent>
    </Card>
  );
}
