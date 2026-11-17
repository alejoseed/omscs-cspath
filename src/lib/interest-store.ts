"use client";

import type { BucketId } from "@/lib/types";

const KEY = "omscs-path-builder:interests:v1";

const VALID = new Set<BucketId>(["high", "medium", "low"]);

/**
 * Bucket assignments live in localStorage, not on the server: a plan is
 * personal, and a shared table would let one visitor overwrite another's
 * choices. Exposed as a tiny external store so React can read it with
 * useSyncExternalStore during render rather than syncing it in an effect.
 */

type Interests = Record<string, BucketId>;

const listeners = new Set<() => void>();

// useSyncExternalStore requires a stable reference for an unchanged snapshot,
// so the parsed object is cached against the raw string it came from.
let cachedRaw: string | null | undefined;
let cachedValue: Interests | null = null;

function parse(raw: string | null): Interests | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result: Interests = {};
    for (const [courseId, bucket] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof bucket === "string" && VALID.has(bucket as BucketId)) {
        result[courseId] = bucket as BucketId;
      }
    }
    return result;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Saved buckets, or null when this visitor has never saved anything. */
export function getSnapshot(): Interests | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

export function getServerSnapshot(): Interests | null {
  return null;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveInterests(interests: Interests): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(interests));
  } catch {
    // Storage can be full or blocked (private mode); the board still works for
    // this session, it just will not survive a reload.
  }
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

/** Empties the board. Distinct from "never saved", so a reload stays empty. */
export function clearInterests(): void {
  saveInterests({});
}
