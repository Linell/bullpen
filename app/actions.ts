"use server";

import { getSubscriptionToken } from "inngest/realtime";
import { inngest } from "@/lib/inngest/client";
import { scoreboardChannel } from "@/lib/inngest/realtime";

export async function getScoreboardToken(): Promise<{ key: string; apiBaseUrl?: string } | null> {
  try {
    const token = await getSubscriptionToken(inngest, { channel: scoreboardChannel, topics: ["games"] });
    return token.key ? { key: token.key, apiBaseUrl: token.apiBaseUrl } : null;
  } catch (err) {
    console.warn("Realtime token unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}
