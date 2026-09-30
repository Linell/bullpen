"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 pt-6 pb-24 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="opacity-70">The board hit a snag loading this page. Give it another try.</p>
          <Button onClick={() => retry()}>Try again</Button>
        </CardContent>
      </Card>
    </main>
  );
}
