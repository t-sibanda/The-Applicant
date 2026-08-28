import { describe, it, expect } from "vitest";
import { analyzeJobs, type JobLite } from "./company-insights";

const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

function job(p: Partial<JobLite>): JobLite {
  return {
    title: "Engineer",
    department: "Engineering",
    location: "Remote",
    url: "http://x",
    postedAt: iso(3),
    ...p,
  };
}

describe("analyzeJobs", () => {
  const jobs: JobLite[] = [
    job({ title: "Software Engineer", department: "Engineering", postedAt: iso(2) }),
    job({ title: "Senior Software Engineer", department: "Engineering", postedAt: iso(4) }),
    job({ title: "Staff Software Engineer", department: "Engineering", postedAt: iso(40) }),
    job({ title: "Account Executive", department: "Sales", location: "New York, NY", postedAt: iso(1) }),
    job({ title: "Account Executive", department: "Sales", location: "Chicago, IL", postedAt: iso(1) }),
    job({ title: "Chief of Staff", department: "Operations", postedAt: iso(10) }),
  ];

  const out = analyzeJobs("Acme", "greenhouse", jobs, "https://acme.com/careers");

  it("counts total openings and recency windows", () => {
    expect(out.totalOpenings).toBe(6);
    expect(out.postedLast7).toBe(4); // iso(2), iso(4), iso(1), iso(1)
    expect(out.postedLast30).toBe(5); // all but iso(40)
  });

  it("ranks departments by open count", () => {
    expect(out.departments[0].name).toBe("Engineering");
    expect(out.departments[0].count).toBe(3);
  });

  it("clusters near-identical titles as high-volume roles", () => {
    // The 3 "* Software Engineer" titles normalize to one cluster of 3.
    const swe = out.hotTitles.find((t) => /software engineer/i.test(t.title));
    expect(swe?.count).toBe(3);
  });

  it("flags single distinct openings as niche", () => {
    const niche = out.rareTitles.map((t) => t.title.toLowerCase());
    expect(niche.some((t) => t.includes("chief of staff"))).toBe(true);
  });

  it("writes a plain-English summary mentioning niche openings", () => {
    expect(out.summary).toMatch(/Acme/);
    expect(out.summary.toLowerCase()).toMatch(/niche|less contested/);
  });
});
