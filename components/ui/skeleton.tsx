import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-pulse rounded-base bg-secondary-background border-2 border-border",
        className,
      )}
      {...props}
    />
  )
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className={cn("h-32", className)} />
      </CardContent>
    </Card>
  )
}

export { Skeleton, CardSkeleton }
