/**
 * In-memory rate limiter.
 *
 * Limits each IP to 5 requests per minute. Simple sliding-window implementation.
 * Resets on server restart (acceptable for this use case — Vercel serverless
 * functions are stateless anyway, so cross-request state doesn't persist long).
 *
 * For production at scale you'd use Redis or similar, but for a take-home
 * assessment with a $5 OpenAI budget, this is sufficient.
 */

interface RateLimitEntry {
  timestamps: number[]; // Unix timestamps in ms
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5;

/**
 * Check if the given identifier (e.g. IP address) is allowed to make a request.
 * Returns true if allowed, false if rate-limited.
 */
export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry) {
    // First request from this IP
    store.set(identifier, { timestamps: [now] });
    return true;
  }

  // Remove timestamps older than the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (entry.timestamps.length < MAX_REQUESTS) {
    // Under the limit — allow and record
    entry.timestamps.push(now);
    return true;
  }

  // Over the limit
  return false;
}

/**
 * Periodically clean up old entries to prevent memory leak.
 * Call this at the start of each request (low overhead).
 */
export function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}
