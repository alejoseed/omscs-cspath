import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Cloudflare D1 binding. D1 has no synchronous driver, so every query in this
 * app is awaited; the planner loads the catalog once per request and works on
 * it in memory from there.
 */
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export function getD1(): D1Database {
  const { env } = getCloudflareContext();
  const db = (env as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error(
      "D1 binding DB is missing. Run `npm run db:create`, put the database_id in wrangler.jsonc, then `npm run db:migrate`.",
    );
  }
  return db;
}

/** Await this inside routes Next may evaluate outside a request (ISR/SSG). */
export async function getD1Async(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error(
      "D1 binding DB is missing. Run `npm run db:create`, put the database_id in wrangler.jsonc, then `npm run db:migrate`.",
    );
  }
  return db;
}
