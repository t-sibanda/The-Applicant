import { describe, it, expect } from "vitest";
import { scoreCompany, compAboveMedian, rankByQuality } from "./quality";
import type { RawJob } from "./job-sources";

function job(comp: RawJob["compensation"]): RawJob {
  return {
    title: "Engineer",
    companyName: "Acme",
    description: "",
    sourceName: "test",
    sourceUrl: "http://x",
    compensation: comp,
    dedupeHash: "h",
  };
}

describe("compAboveMedian", () => {
  it("returns null when no median is provided", () => {
    expect(compAboveMedian(job({ min: 100, max: 200 }), null)).toBeNull();
  });
  it("returns null when the job has no compensation", () => {
    expect(compAboveMedian(job(null), 100000)).toBeNull();
  });
  it("flags above-median compensation", () => {
    expect(compAboveMedian(job({ min: 150000, max: 170000 }), 120000)).toBe(true);
  });
  it("flags below-median compensation", () => {
    expect(compAboveMedian(job({ min: 80000, max: 90000 }), 120000)).toBe(false);
  });
});

describe("scoreCompany", () => {
  it("marks a company unrated when no signals exist", () => {
    const r = scoreCompany({}, null);
    expect(r.unrated).toBe(true);
    expect(r.qualityScore).toBeNull();
    expect(r.basis).toEqual([]);
  });

  it("scores using available culture/retention signals and lists the basis", () => {
    const r = scoreCompany({ cultureScore: 80, retentionScore: 90 }, null);
    expect(r.unrated).toBe(false);
    expect(r.qualityScore).toBe(85);
    expect(r.basis).toContain("culture");
    expect(r.basis).toContain("retention");
  });

  it("incorporates above-median compensation into the score", () => {
    const r = scoreCompany({}, true);
    expect(r.unrated).toBe(false);
    expect(r.compAboveMedian).toBe(true);
    expect(r.basis).toContain("compensation");
  });
});

describe("rankByQuality", () => {
  it("sorts higher scores first and pushes unrated last", () => {
    const ranked = rankByQuality([
      { qualityScore: 50 },
      { qualityScore: null },
      { qualityScore: 90 },
    ]);
    expect(ranked.map((r) => r.qualityScore)).toEqual([90, 50, null]);
  });
});
