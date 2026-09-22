// Baseball schedules are shown in a single fixed zone so server and client agree.
export const TIME_ZONE = "America/Los_Angeles";
export const TIME_ZONE_LABEL = "PT";

export function formatGameTime(iso: string) {
  const time = new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} ${TIME_ZONE_LABEL}`;
}

export function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
