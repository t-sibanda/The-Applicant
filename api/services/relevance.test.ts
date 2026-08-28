import { describe, it, expect } from "vitest";
import { passesFilters, scoreRelevance } from "./relevance";
import type { RawJob } from "./job-sources";

function job(partial: Partial<RawJob>): RawJob {
  return {
    title: "Program Manager",
    companyName: "Acme",
    description: "Great role.",
    sourceName: "test",
    sourceUrl: "http://x",
    location: null,
    compensation: null,
    dedupeHash: "h",
    ...partial,
  };
}

describe("passesFilters — location", () => {
  it("matches a US state name against a 'CA' style location", () => {
    const j = job({ location: "San Francisco, CA" });
    expect(passesFilters(j, { location: "California" })).toBe(true);
  });

  it("matches a state abbreviation against a full state name in text", () => {
    const j = job({ location: "Los Angeles, California" });
    expect(passesFilters(j, { location: "CA" })).toBe(true);
  });

  it("keeps remote jobs for a state filter (location-flexible)", () => {
    const j = job({ location: "Remote", description: "Work remote from anywhere." });
    expect(passesFilters(j, { location: "California" })).toBe(true);
  });

  it("does not reject jobs that carry no location signal at all", () => {
    const j = job({ location: null, title: "Program Manager", description: "Lead projects." });
    expect(passesFilters(j, { location: "California" })).toBe(true);
  });

  it("rejects a job whose location clearly does not match", () => {
    const j = job({ location: "Austin, TX", description: "Onsite in Texas." });
    expect(passesFilters(j, { location: "California" })).toBe(false);
  });

  it("matches a city name directly", () => {
    const j = job({ location: "Columbus, OH" });
    expect(passesFilters(j, { location: "Columbus" })).toBe(true);
  });
});

describe("passesFilters — company", () => {
  it("matches company substring case-insensitively", () => {
    const j = job({ companyName: "Nimbus Cloud" });
    expect(passesFilters(j, { company: "nimbus" })).toBe(true);
    expect(passesFilters(j, { company: "atlas" })).toBe(false);
  });
});

describe("scoreRelevance", () => {
  it("scores a strong title match highly", () => {
    const j = job({ title: "Senior Program Manager", description: "Program management role." });
    expect(scoreRelevance(j, { targetRole: "Program Manager" })).toBeGreaterThanOrEqual(60);
  });

  it("returns neutral 60 when there is no targeting", () => {
    const j = job({});
    expect(scoreRelevance(j, {})).toBe(60);
  });
});
