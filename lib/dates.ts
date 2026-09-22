// MLB's officialDate follows US Eastern time.
export function easternDate(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getTime() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
