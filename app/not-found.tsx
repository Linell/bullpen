import Link from "next/link";
import { PageMain } from "@/components/page-main";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageMain className="max-w-3xl items-center justify-center text-center">
      <h1>Nothing here</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="opacity-70">
            That page isn&apos;t on the board. Check the address, or head back to today&apos;s slate.
          </p>
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Back to today&apos;s scoreboard
          </Link>
        </CardContent>
      </Card>
    </PageMain>
  );
}
