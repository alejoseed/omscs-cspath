/**
 * Small fixed-window rate limiter for the expensive /api/plan route. The solver
 * is cheap, but each run also spends DeepSeek tokens, so an open endpoint would
 * let anyone burn the key owner's credits.
 */

interface Window {
  count: number;
  resetAt: number;
}

const WINDOWS = new Map<string, Window>();
const LIMIT = Number(process.env.PLAN_RATE_LIMIT ?? 15);
const WINDOW_MS = Number(process.env.PLAN_RATE_WINDOW_MS ?? 60_000);

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "local";
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateResult {
  const now = Date.now();
  const current = WINDOWS.get(key);

  if (!current || current.resetAt <= now) {
    WINDOWS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1, retryAfterSeconds: 0 };
  }

  if (current.count >= LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: LIMIT - current.count,
    retryAfterSeconds: 0,
  };
}

/** Keeps the map from growing without bound on a long-running server. */
export function pruneRateWindows(): void {
  const now = Date.now();
  for (const [key, window] of WINDOWS) {
    if (window.resetAt <= now) WINDOWS.delete(key);
  }
}
