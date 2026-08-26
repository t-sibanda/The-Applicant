import type { RawJob } from "./job-sources";

/**
 * Employer quality scoring: flags above-median compensation and combines
 * available culture/retention signals into a transparent quality score.
 *
 * Honesty rule: when no signals are available, a company is marked `unrated`
 * and NOT given a fabricated score.
 */

export interface CompanySignals {
  cultureScore?: number; // 0-100 if available from a data source
  retentionScore?: number; // 0-100 if available
}

export interface QualityResult {
  qualityScore: number | null; // null when unrated
  unrated: boolean;
  compAboveMedian: boolean | null;
  basis: string[]; // which signals contributed
}

/**
 * Compute whether a job's compensation is above the provided role/industry
 * median. Returns null when the job has no compensation data.
 */
export function compAboveMedian(
  job: RawJob,
  medianAnnual: number | null,
): boolean | null {
  if (!medianAnnual || !job.compensation) return null;
  const { min, max } = job.compensation;
  const mid =
    min != null && max != null ? (min + max) / 2 : (max ?? min ?? null);
  if (mid == null) return null;
  return mid > medianAnnual;
}

/**
 * Combine available signals into a 0-100 quality score. Only signals that are
 * present contribute; the basis lists what was used. If nothing is available,
 * the company is unrated.
 */
export function scoreCompany(
  signals: CompanySignals,
  compAbove: boolean | null,
): QualityResult {
  const parts: number[] = [];
  const basis: string[] = [];

  if (typeof signals.cultureScore === "number") {
    parts.push(clamp(signals.cultureScore));
    basis.push("culture");
  }
  if (typeof signals.retentionScore === "number") {
    parts.push(clamp(signals.retentionScore));
    basis.push("retention");
  }
  if (compAbove != null) {
    parts.push(compAbove ? 90 : 40);
    basis.push("compensation");
  }

  if (parts.length === 0) {
    return {
      qualityScore: null,
      unrated: true,
      compAboveMedian: compAbove,
      basis: [],
    };
  }

  const avg = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return {
    qualityScore: avg,
    unrated: false,
    compAboveMedian: compAbove,
    basis,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Rank jobs favoring higher quality scores (unrated sort last). Used when the
 * user enables quality filtering.
 */
export function rankByQuality<
  T extends { qualityScore?: number | null },
>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const av = a.qualityScore ?? -1;
    const bv = b.qualityScore ?? -1;
    return bv - av;
  });
}
