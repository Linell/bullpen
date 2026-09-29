import { describe, expect, it } from "vitest";
import { gamePath, leadersPath, playerPath, teamPath } from "@/lib/routes";

describe("routes", () => {
  it("builds team and game paths", () => {
    expect(teamPath(147)).toBe("/teams/147");
    expect(teamPath(147, 2025)).toBe("/teams/147/2025");
    expect(gamePath(823394)).toBe("/games/823394");
  });

  it("builds player paths by role and season", () => {
    expect(playerPath(543037)).toBe("/players/543037");
    expect(playerPath(543037, { role: "pitching" })).toBe("/players/543037/pitching");
    expect(playerPath(543037, { role: "hitting", season: 2025 })).toBe("/players/543037/hitting/2025");
  });

  it("builds leaders paths, leaving out default filters", () => {
    expect(leadersPath()).toBe("/leaders");
    expect(leadersPath({ range: "today", limit: 25 })).toBe("/leaders");
    expect(leadersPath({ range: "week" })).toBe("/leaders?range=week");
    expect(leadersPath({ limit: 50 })).toBe("/leaders?limit=50");
    expect(leadersPath({ range: "season", limit: 10 })).toBe("/leaders?range=season&limit=10");
  });
});
