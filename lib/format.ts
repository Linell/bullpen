const MISSING = "—";

export function formatAverage(value: number | null) {
  if (value === null) return MISSING;
  const fixed = value.toFixed(3);
  return fixed.startsWith("0") ? fixed.slice(1) : fixed;
}

export function formatPercent(value: number | null) {
  return value === null ? MISSING : `${(value * 100).toFixed(1)}%`;
}

export function formatDecimal(value: number | null, digits = 1) {
  return value === null ? MISSING : value.toFixed(digits);
}

export function formatCount(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function formatInnings(innings: number) {
  const outs = Math.round(innings * 3);
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}
