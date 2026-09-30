import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFeed, fetchSeasonDates } from "@/lib/mlb";

function respond(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers })));
}

afterEach(() => vi.unstubAllGlobals());

describe("MLB Stats API errors", () => {
  it("doesn't retry a 4xx", async () => {
    respond(404);
    await expect(fetchFeed(1)).rejects.toMatchObject({ name: "NonRetriableError" });
  });

  it("retries a 429 after its Retry-After", async () => {
    respond(429, {}, { "retry-after": "5" });
    await expect(fetchFeed(1)).rejects.toMatchObject({ name: "RetryAfterError" });
  });

  it("retries a 5xx", async () => {
    respond(503);
    await expect(fetchFeed(1)).rejects.toMatchObject({ name: "Error" });
  });

  it("doesn't retry a season that doesn't exist", async () => {
    respond(200, { seasons: [] });
    await expect(fetchSeasonDates(1850)).rejects.toMatchObject({ name: "NonRetriableError" });
  });
});
