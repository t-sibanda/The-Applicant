import { describe, it, expect } from "vitest";
import { suggestCompanies } from "./company-suggest";

describe("suggestCompanies", () => {
  it("ranks AI companies highly for an AI/ML profile", () => {
    const out = suggestCompanies({ keywords: ["ai", "ml", "research"] });
    const names = out.map((c) => c.name);
    expect(names).toContain("Anthropic");
    expect(names).toContain("OpenAI");
    // AI labs should surface near the top, ahead of unrelated matches.
    const anthropicIdx = names.indexOf("Anthropic");
    expect(anthropicIdx).toBeGreaterThanOrEqual(0);
    expect(anthropicIdx).toBeLessThan(10);
  });

  it("boosts a company named directly in keywords", () => {
    const out = suggestCompanies({ role: "Engineer", keywords: ["nvidia"] });
    expect(out[0].name).toBe("NVIDIA");
  });

  it("flags searchable vs external companies correctly", () => {
    const out = suggestCompanies({ keywords: ["nvidia", "anthropic"] });
    const nvidia = out.find((c) => c.name === "NVIDIA");
    const anthropic = out.find((c) => c.name === "Anthropic");
    expect(nvidia?.searchable).toBe(false);
    expect(nvidia?.careersUrl).toBeTruthy();
    expect(anthropic?.searchable).toBe(true);
    expect(anthropic?.token).toBe("anthropic");
  });

  it("returns a sensible default set when there is no signal", () => {
    const out = suggestCompanies({});
    expect(out.length).toBeGreaterThan(0);
    // Defaults should all be searchable employers.
    expect(out.every((c) => c.searchable)).toBe(true);
  });

  it("respects the limit", () => {
    const out = suggestCompanies({ industry: "software", limit: 5 });
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it("narrows results to a chosen industry", () => {
    const ent = suggestCompanies({ industryId: "entertainment" });
    expect(ent.length).toBeGreaterThan(0);
    // Every result should carry an entertainment-related tag.
    const entTags = ["media", "streaming", "gaming", "entertainment", "music", "video"];
    expect(ent.every((c) => c.tags.some((t) => entTags.includes(t)))).toBe(true);

    const health = suggestCompanies({ industryId: "healthcare" });
    const healthTags = ["healthcare", "biotech", "life sciences", "medical", "pharma"];
    expect(health.every((c) => c.tags.some((t) => healthTags.includes(t)))).toBe(true);
  });
});
