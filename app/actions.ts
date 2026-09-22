"use server";

import { getSubscriptionToken } from "inngest/realtime";
import { inngest } from "@/lib/inngest/client";
import { scoreboardChannel } from "@/lib/inngest/realtime";

// A read-only token for the public scoreboard topic. Returns null when realtime is unavailable.
export async function getScoreboardToken(): Promise<{ key: string; apiBaseUrl?: string } | null> {
  try {
    const token = await getSubscriptionToken(inngest, { channel: scoreboardChannel, topics: ["games"] });
    return token.key ? { key: token.key, apiBaseUrl: token.apiBaseUrl } : null;
  } catch (err) {
    console.warn("Realtime token unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}
