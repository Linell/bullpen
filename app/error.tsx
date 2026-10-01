"use client";

import { useEffect } from "react";
import { PageMain } from "@/components/page-main";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageMain className="max-w-3xl items-center justify-center text-center">
      <h1>Something went wrong</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="opacity-70">The board hit a snag loading this page. Give it another try.</p>
          <Button onClick={() => retry()}>Try again</Button>
        </CardContent>
      </Card>
    </PageMain>
  );
}
