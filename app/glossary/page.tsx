import type { Metadata } from "next";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = { title: "Glossary" };

const ENTRIES = Object.entries(GLOSSARY).sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }));

export default function GlossaryPage() {
  return (
    <main className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col gap-6 px-6 pt-6 pb-24">
      <h1>Glossary</h1>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        {ENTRIES.map(([term, definition]) => (
          <div key={term} className="contents">
            <dt className="font-heading">{term}</dt>
            <dd className="opacity-70">{definition}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
