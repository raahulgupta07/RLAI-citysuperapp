// In-memory rate limiter for login attempts
// Tracks attempts per key (username or IP) with sliding window

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSec: 0 };
  }

  entry.attempts++;

  if (entry.attempts > maxAttempts) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return { allowed: true, remaining: maxAttempts - entry.attempts, retryAfterSec: 0 };
}
