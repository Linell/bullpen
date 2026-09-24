export type Half = "top" | "bottom";

export type PlayRow = {
  at_bat_index: number;
  inning: number;
  half: Half;
  batter_name: string;
  pitcher_id: number;
  pitcher_name: string;
  pitcher_last_name: string;
  description: string | null;
  is_scoring_play: boolean | null;
  away_score_after: number | null;
  home_score_after: number | null;
};

export type PitchRow = {
  kind: "pitch";
  at_bat_index: number;
  step_index: number;
  pitch_number: number | null;
  balls_before: number;
  strikes_before: number;
  pitch_type_desc: string | null;
  start_speed: number | null;
  call_desc: string | null;
  is_in_play: boolean | null;
  is_strike: boolean | null;
  plate_x: number | null;
  plate_z: number | null;
  sz_top: number | null;
  sz_bottom: number | null;
  abs_challenged: boolean;
  abs_overturned: boolean | null;
};

export type PlayEventKind = "action" | "pickoff" | "stepoff" | "no_pitch";

export type PlayEventRow = {
  kind: PlayEventKind;
  at_bat_index: number;
  step_index: number;
  event_type: string | null;
  description: string | null;
};

export type StepRow = PitchRow | PlayEventRow;

export type PitchResult = "ball" | "strike" | "in_play";

export type Pitch = {
  kind: "pitch";
  index: number;
  number: number | null;
  count: string;
  type: string | null;
  speed: number | null;
  call: string | null;
  result: PitchResult;
  abs?: "overturned" | "upheld";
  plateX: number | null;
  plateZ: number | null;
  zoneTop: number | null;
  zoneBottom: number | null;
};

export type PlayEvent = {
  kind: "event";
  index: number;
  description: string | null;
};

export type Step = Pitch | PlayEvent;

export type PitchingChange = {
  incoming: string;
  outgoing: string;
};

export type PlateAppearance = {
  atBatIndex: number;
  batter: string;
  pitcher: string;
  pitchingChange?: PitchingChange;
  description: string | null;
  score?: { away: number; home: number };
  steps: Step[];
};

export type HalfInning = {
  inning: number;
  half: Half;
  plateAppearances: PlateAppearance[];
};

const SHOWN_EVENT_TYPES = new Set([
  "offensive_substitution",
  "defensive_substitution",
  "defensive_switch",
  "umpire_substitution",
  "stolen_base_2b",
  "stolen_base_3b",
  "stolen_base_home",
  "caught_stealing_2b",
  "caught_stealing_3b",
  "caught_stealing_home",
  "defensive_indiff",
  "error",
  "pickoff_1b",
  "pickoff_2b",
  "pickoff_3b",
  "pickoff_caught_stealing_2b",
  "pickoff_caught_stealing_3b",
  "pickoff_caught_stealing_home",
  "pickoff_error_1b",
  "pickoff_error_2b",
  "pickoff_error_3b",
  "wild_pitch",
  "passed_ball",
  "balk",
  "runner_placed",
  "ejection",
]);

export function isShownEvent(event: Pick<PlayEventRow, "kind" | "event_type">) {
  return event.kind === "no_pitch" || SHOWN_EVENT_TYPES.has(event.event_type ?? "");
}

function pitchResult(p: PitchRow): PitchResult {
  if (p.is_in_play) return "in_play";
  return p.is_strike ? "strike" : "ball";
}

function absResult(p: PitchRow) {
  if (!p.abs_challenged) return undefined;
  return p.abs_overturned ? "overturned" : "upheld";
}

function toPitch(p: PitchRow): Pitch {
  return {
    kind: "pitch",
    index: p.step_index,
    number: p.pitch_number,
    count: `${p.balls_before}-${p.strikes_before}`,
    type: p.pitch_type_desc,
    speed: p.start_speed,
    call: p.call_desc,
    result: pitchResult(p),
    abs: absResult(p),
    plateX: p.plate_x,
    plateZ: p.plate_z,
    zoneTop: p.sz_top,
    zoneBottom: p.sz_bottom,
  };
}

function toPlayEvent(e: PlayEventRow): PlayEvent {
  return { kind: "event", index: e.step_index, description: e.description };
}

export function toSteps(rows: StepRow[]): Step[] {
  return rows
    .filter((row) => row.kind === "pitch" || isShownEvent(row))
    .map((row) => (row.kind === "pitch" ? toPitch(row) : toPlayEvent(row)))
    .sort((a, b) => a.index - b.index);
}

function groupBy<T>(rows: T[], key: (row: T) => number) {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) group.push(row);
    else groups.set(key(row), [row]);
  }
  return groups;
}

function toPitchingChange(play: PlayRow, previous: PlayRow | undefined): PitchingChange | undefined {
  if (!previous || previous.pitcher_id === play.pitcher_id) return undefined;
  return { incoming: play.pitcher_last_name, outgoing: previous.pitcher_last_name };
}

function toPlateAppearance(play: PlayRow, previous: PlayRow | undefined, steps: StepRow[]): PlateAppearance {
  const { away_score_after: away, home_score_after: home } = play;
  return {
    atBatIndex: play.at_bat_index,
    batter: play.batter_name,
    pitcher: play.pitcher_name,
    pitchingChange: toPitchingChange(play, previous),
    description: play.description,
    score: play.is_scoring_play && away != null && home != null ? { away, home } : undefined,
    steps: toSteps(steps),
  };
}

export function toHalfInnings(plays: PlayRow[], steps: StepRow[]): HalfInning[] {
  const stepsByAtBat = groupBy(steps, (s) => s.at_bat_index);
  const previousPlayByHalf = new Map<Half, PlayRow>();
  const halves: HalfInning[] = [];
  for (const play of plays) {
    const previous = previousPlayByHalf.get(play.half);
    const pa = toPlateAppearance(play, previous, stepsByAtBat.get(play.at_bat_index) ?? []);
    previousPlayByHalf.set(play.half, play);
    const last = halves.at(-1);
    if (last?.inning === play.inning && last.half === play.half) last.plateAppearances.push(pa);
    else halves.push({ inning: play.inning, half: play.half, plateAppearances: [pa] });
  }
  return halves;
}

const ORDINAL_SUFFIXES: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" });

export function halfInningLabel(inning: number, half: Half) {
  const suffix = ORDINAL_SUFFIXES[ordinalRules.select(inning)];
  return `${half === "top" ? "Top" : "Bottom"} ${inning}${suffix}`;
}
