import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Bullpen", template: "%s · Bullpen" },
  description: "Baseball data straight from the hose.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        {children}
        <footer className="mx-auto w-full max-w-(--breakpoint-2xl) px-6 py-6 text-sm opacity-70">
          <nav aria-label="Footer">
            <Link href="/glossary" className="hover:underline">
              Glossary
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
