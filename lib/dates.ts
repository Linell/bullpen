export function easternDate(offsetDays = 0, now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}
