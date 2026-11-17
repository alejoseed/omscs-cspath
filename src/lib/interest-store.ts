"use client";

import type { BucketId } from "@/lib/types";

const KEY = "omscs-path-builder:interests:v1";

const VALID = new Set<BucketId>(["high", "medium", "low"]);

/**
 * Bucket assignments live in localStorage, not on the server: a plan is
 * personal, and a shared SQLite table would let one visitor overwrite another's
 * choices. Returns null when storage is unavailable or the payload is corrupt.
 */
export function readInterests(): Record<string, BucketId> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result: Record<string, BucketId> = {};
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

export function writeInterests(interests: Record<string, BucketId>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(interests));
  } catch {
    // Storage can be full or blocked (private mode). The board still works for
    // this session; it just will not survive a reload.
  }
}

export function clearInterests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
