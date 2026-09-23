import { describe, expect, it } from "vitest";
import { VIEW, toSvgX, toSvgY } from "@/lib/strike-zone";

describe("strike zone mapping", () => {
  it("keeps the catcher's view: positive plate_x to the right, higher plate_z toward the top", () => {
    expect(toSvgX(0.5)).toBeGreaterThan(toSvgX(-0.5));
    expect(toSvgX(0.5)).toBe(50);
    expect(toSvgY(3)).toBeLessThan(toSvgY(2));
    expect(toSvgY(2.5)).toBe(-250);
  });

  it("clamps wild pitches to the view", () => {
    expect(toSvgX(-5)).toBe(VIEW.left);
    expect(toSvgY(-1)).toBe(-VIEW.bottom);
  });
});
