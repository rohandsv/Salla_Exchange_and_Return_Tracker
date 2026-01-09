type Entry = { count: number; resetAt: number };

const bucket = new Map<string, Entry>();

export function checkRateLimit(key: string, windowMs: number, max: number): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const e = bucket.get(key);

  if (!e || e.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (e.count >= max) {
    const retryAfterSec = Math.ceil((e.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  e.count += 1;
  bucket.set(key, e);
  return { allowed: true };
}
