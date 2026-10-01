"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export function NavLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const isActive = usePathname().startsWith(href);
  return <Link href={href} aria-current={isActive ? "page" : undefined} {...props} />;
}
