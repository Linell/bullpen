const TIME_ZONE = "America/Los_Angeles";
const TIME_ZONE_LABEL = "PT";

const OFFICIAL_TIME_ZONE = "America/New_York";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatGameTime(iso: string) {
  const time = new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} ${TIME_ZONE_LABEL}`;
}

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

export function clampDateRange(
  requested: { startDate?: string; endDate?: string },
  bounds: { startDate: string; endDate: string },
) {
  return {
    startDate: requested.startDate && requested.startDate > bounds.startDate ? requested.startDate : bounds.startDate,
    endDate: requested.endDate && requested.endDate < bounds.endDate ? requested.endDate : bounds.endDate,
  };
}

export function formatOfficialDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export function formatCountdown(ms: number) {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 0) return undefined;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
