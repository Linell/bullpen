// Baseball schedules are shown in a single fixed zone so server and client agree.
export const TIME_ZONE = "America/Los_Angeles";
export const TIME_ZONE_LABEL = "PT";

// MLB's officialDate follows Eastern time.
export const OFFICIAL_TIME_ZONE = "America/New_York";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatGameTime(iso: string) {
  const time = new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} ${TIME_ZONE_LABEL}`;
}

// Today's MLB official date, as YYYY-MM-DD.
export function todayOfficialDate(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: OFFICIAL_TIME_ZONE });
}

export function isOfficialDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "Tuesday, September 22" for a YYYY-MM-DD date.
export function formatOfficialDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
