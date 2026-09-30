"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { gameChannel, LIVE_TOPICS, scoreboardChannel } from "./channels";
import { inngest } from "./client";

export async function scoreboardToken() {
  return getClientSubscriptionToken(inngest, { channel: scoreboardChannel, topics: [...LIVE_TOPICS] });
}

export async function gameToken(gamePk: number) {
  if (!Number.isSafeInteger(gamePk) || gamePk <= 0) throw new Error("gamePk must be a positive integer");
  return getClientSubscriptionToken(inngest, { channel: gameChannel({ gamePk }), topics: [...LIVE_TOPICS] });
}
