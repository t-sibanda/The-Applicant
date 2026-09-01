import { describe, it, expect } from "vitest";
import { extractKeywords, keywordCoverage, analyzeAts } from "./ats";

const JD = `About Anthropic
Anthropic is a leading AI safety company. We are seeking a Senior Product Manager
to own the roadmap for our developer platform. You will work with engineering
teams to ship features using Python, TypeScript, and Kubernetes. Experience with
AWS, Docker, and Postgres is required. Strong stakeholder management and agile
delivery are essential. Anthropic values thoughtful, careful builders.`;

describe("extractKeywords — objectivity", () => {
  it("does not treat the hiring company name as a keyword when hinted", () => {
    const kws = extractKeywords(JD, { companyHint: "Anthropic" });
    expect(kws).not.toContain("anthropic");
  });

  it("drops company/proper nouns even without a hint", () => {
    const kws = extractKeywords(JD);
    // "Anthropic" appears capitalized mid-text, so it is flagged as a proper noun.
    expect(kws).not.toContain("anthropic");
  });

  it("excludes generic filler words", () => {
    const kws = extractKeywords(JD);
    for (const filler of ["about", "company", "seeking", "required", "strong"]) {
      expect(kws).not.toContain(filler);
    }
  });

  it("keeps recognized skills", () => {
    const kws = extractKeywords(JD);
    expect(kws).toContain("python");
    expect(kws).toContain("kubernetes");
    expect(kws).toContain("aws");
  });

  it("keeps tokens with technical symbols like c++ and c#", () => {
    const kws = extractKeywords("We use C++ and C# heavily on the platform team.");
    expect(kws).toContain("c++");
    expect(kws).toContain("c#");
  });

  it("ranks recognized skills above generic terms of equal frequency", () => {
    const text = "widget python widget python";
    const kws = extractKeywords(text, { max: 2 });
    // Both appear twice, but python carries a skill weight so it ranks first.
    expect(kws[0]).toBe("python");
  });

  it("is deterministic across repeated runs", () => {
    const a = extractKeywords(JD, { companyHint: "Anthropic" });
    const b = extractKeywords(JD, { companyHint: "Anthropic" });
    expect(a).toEqual(b);
  });
});

describe("keywordCoverage + analyzeAts", () => {
  it("passes the company hint through so it is not required", () => {
    const resume = "Senior Product Manager. Python, TypeScript, AWS, Docker, agile.";
    const cov = keywordCoverage(resume, JD, "Anthropic");
    expect(cov.matched).not.toContain("anthropic");
    expect(cov.missing).not.toContain("anthropic");
  });

  it("produces a stable base score for the same input", () => {
    const resume = "Product Manager with Python and AWS experience.";
    const first = analyzeAts(resume, JD, "Anthropic").baseScore;
    const second = analyzeAts(resume, JD, "Anthropic").baseScore;
    expect(first).toBe(second);
  });
});
