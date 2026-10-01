import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function PageMain({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn("mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24", className)}
      {...props}
    />
  );
}
