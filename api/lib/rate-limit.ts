import { TRPCError } from "@trpc/server";

// Simple in-memory sliding-window rate limiter (per process).
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Please try again later.",
    });
  }
  hits.push(now);
  buckets.set(key, hits);
}
