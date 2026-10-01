import type { Metadata } from "next";
import { PageMain } from "@/components/page-main";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = { title: "Glossary" };

const ENTRIES = Object.entries(GLOSSARY).sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }));

export default function GlossaryPage() {
  return (
    <PageMain>
      <h1>Glossary</h1>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        {ENTRIES.map(([term, definition]) => (
          <div key={term} className="contents">
            <dt className="font-heading">{term}</dt>
            <dd className="opacity-70">{definition}</dd>
          </div>
        ))}
      </dl>
    </PageMain>
  );
}
