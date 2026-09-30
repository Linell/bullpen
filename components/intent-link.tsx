"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

export function IntentLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      onTouchStart={() => setIntent(true)}
    />
  );
}
