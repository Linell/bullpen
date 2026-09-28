"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function SeasonKeys({ olderHref, newerHref }: { olderHref?: string; newerHref?: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const href = event.key === "[" ? olderHref : event.key === "]" ? newerHref : undefined;
      if (href) router.push(href, { scroll: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, olderHref, newerHref]);

  return null;
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
