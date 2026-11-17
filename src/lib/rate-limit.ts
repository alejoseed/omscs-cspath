import type { D1Database } from "@/lib/d1";

/**
 * Fixed-window rate limiter for the expensive /api/plan route. It is stored in
 * D1 rather than process memory: a Workers isolate is not long-lived, so an
 * in-memory counter would reset unpredictably and let someone burn the DeepSeek
 * key owner's credits.
 */

const LIMIT = Number(process.env.PLAN_RATE_LIMIT ?? 15);
const WINDOW_MS = Number(process.env.PLAN_RATE_WINDOW_MS ?? 60_000);

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip");
  if (forwarded) return forwarded;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "local";
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  db: D1Database,
  key: string,
): Promise<RateResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const id = `${key}:${windowStart}`;

  // Atomic increment; a fresh window starts at 0 because the row id changes.
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (id, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(id, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? LIMIT + 1;
  if (count > LIMIT) {
    const resetIn = windowStart + WINDOW_MS - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(resetIn / 1000)),
    };
  }

  return { allowed: true, remaining: LIMIT - count, retryAfterSeconds: 0 };
}

/** Drops windows that have already elapsed so the table stays tiny. */
export async function pruneRateWindows(db: D1Database): Promise<void> {
  const cutoff = Date.now() - WINDOW_MS * 10;
  await db
    .prepare("DELETE FROM rate_limits WHERE window_start < ?")
    .bind(cutoff)
    .run();
}
