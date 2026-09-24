import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 pt-6 pb-24 text-center">
      <h1 className="text-4xl">Caught looking</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="opacity-70">
            That game isn&apos;t on the board. Check the game number, or head back to today&apos;s slate.
          </p>
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Back to today&apos;s scoreboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
