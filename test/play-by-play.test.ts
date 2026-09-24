import { describe, expect, it } from "vitest";
import {
  halfInningLabel,
  isShownEvent,
  toHalfInnings,
  toSteps,
  type PitchRow,
  type PlayEventKind,
  type PlayEventRow,
  type PlayRow,
} from "@/lib/play-by-play";

function pitch(at_bat_index: number, step_index: number, pitch_number: number, overrides: Partial<PitchRow> = {}): PitchRow {
  return {
    kind: "pitch",
    at_bat_index,
    step_index,
    pitch_number,
    balls_before: 0,
    strikes_before: 0,
    pitch_type_desc: "Sinker",
    start_speed: 94.1,
    call_desc: "Ball",
    is_in_play: false,
    is_strike: false,
    plate_x: 0,
    plate_z: 2.5,
    sz_top: 3.4,
    sz_bottom: 1.6,
    abs_challenged: false,
    abs_overturned: null,
    ...overrides,
  };
}

function event(at_bat_index: number, step_index: number, kind: PlayEventKind, event_type: string | null): PlayEventRow {
  return { at_bat_index, step_index, kind, event_type, description: `${kind} ${event_type}` };
}

function play(at_bat_index: number, inning: number, half: "top" | "bottom", pitcher_id = 1): PlayRow {
  return {
    at_bat_index,
    inning,
    half,
    batter_name: "Batter",
    pitcher_id,
    pitcher_name: `Pitcher${pitcher_id}, P`,
    pitcher_last_name: `Pitcher${pitcher_id}`,
    description: "Batter grounds out.",
    is_scoring_play: false,
    away_score_after: 0,
    home_score_after: 0,
  };
}

describe("isShownEvent", () => {
  it("keeps automatic balls and strikes and allowlisted actions", () => {
    expect(isShownEvent({ kind: "no_pitch", event_type: null })).toBe(true);
    expect(isShownEvent({ kind: "action", event_type: "defensive_indiff" })).toBe(true);
    expect(isShownEvent({ kind: "action", event_type: "umpire_substitution" })).toBe(true);
    expect(isShownEvent({ kind: "pickoff", event_type: "pickoff_1b" })).toBe(true);
  });

  it("drops noise and pickoff attempts", () => {
    expect(isShownEvent({ kind: "action", event_type: "batter_timeout" })).toBe(false);
    expect(isShownEvent({ kind: "stepoff", event_type: null })).toBe(false);
    expect(isShownEvent({ kind: "pickoff", event_type: null })).toBe(false);
  });
});

describe("toSteps", () => {
  it("merges pitches and shown events by index, including events before the first pitch", () => {
    const steps = toSteps([
      pitch(0, 4, 2, { is_in_play: true }),
      event(0, 0, "action", "umpire_substitution"),
      event(0, 3, "action", "defensive_indiff"),
      pitch(0, 1, 1, { is_strike: true, abs_challenged: true, abs_overturned: true }),
      event(0, 2, "no_pitch", null),
      event(0, 5, "action", "batter_timeout"),
    ]);
    expect(steps.map((s) => [s.kind, s.index])).toEqual([
      ["event", 0],
      ["pitch", 1],
      ["event", 2],
      ["event", 3],
      ["pitch", 4],
    ]);
    expect(steps[0]).toMatchObject({ description: "action umpire_substitution" });
    expect(steps[1]).toMatchObject({ number: 1, result: "strike", abs: "overturned", count: "0-0" });
    expect(steps[3]).toMatchObject({ description: "action defensive_indiff" });
    expect(steps[4]).toMatchObject({ number: 2, result: "in_play", abs: undefined });
  });
});

describe("toHalfInnings", () => {
  it("groups plate appearances by half-inning and keeps the score after scoring plays", () => {
    const scoring = { ...play(1, 1, "top"), is_scoring_play: true, away_score_after: 1 };
    const halves = toHalfInnings([play(0, 1, "top"), scoring, play(2, 1, "bottom")], [pitch(1, 0, 1)]);
    expect(halves.map((h) => [h.inning, h.half, h.plateAppearances.length])).toEqual([
      [1, "top", 2],
      [1, "bottom", 1],
    ]);
    expect(halves[0].plateAppearances[0].score).toBeUndefined();
    expect(halves[0].plateAppearances[1]).toMatchObject({ score: { away: 1, home: 0 }, steps: [{ kind: "pitch" }] });
  });

  it("marks pitching changes per half, including at the start of a half-inning", () => {
    const halves = toHalfInnings(
      [play(0, 1, "top", 1), play(1, 1, "bottom", 2), play(2, 1, "bottom", 3), play(3, 2, "top", 4), play(4, 2, "bottom", 3)],
      [],
    );
    expect(halves.flatMap((h) => h.plateAppearances.map((pa) => pa.pitchingChange))).toEqual([
      undefined,
      undefined,
      { incoming: "Pitcher3", outgoing: "Pitcher2" },
      { incoming: "Pitcher4", outgoing: "Pitcher1" },
      undefined,
    ]);
  });
});

describe("halfInningLabel", () => {
  it("uses ordinals", () => {
    expect(halfInningLabel(1, "top")).toBe("Top 1st");
    expect(halfInningLabel(2, "bottom")).toBe("Bottom 2nd");
    expect(halfInningLabel(3, "top")).toBe("Top 3rd");
    expect(halfInningLabel(10, "top")).toBe("Top 10th");
    expect(halfInningLabel(11, "bottom")).toBe("Bottom 11th");
    expect(halfInningLabel(12, "top")).toBe("Top 12th");
    expect(halfInningLabel(13, "bottom")).toBe("Bottom 13th");
  });
});
