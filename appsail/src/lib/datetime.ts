// src/lib/datetime.ts
function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Catalyst DateTime string: "YYYY-MM-DD HH:mm:ss"
 * Uses Node runtime timezone (process.env.TZ).
 */
export function toCatalystDateTime(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/**
 * Safe lexicographic compare for the same format:
 * returns true if a > b
 */
export function catalystDtAfter(a: string, b: string): boolean {
  return String(a) > String(b);
}
