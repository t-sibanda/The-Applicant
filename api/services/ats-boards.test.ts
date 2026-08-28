import { describe, it, expect } from "vitest";
import { parseBoardEnv, GREENHOUSE_BOARDS, LEVER_BOARDS } from "./ats-boards";

describe("parseBoardEnv", () => {
  it("returns null for empty/undefined input", () => {
    expect(parseBoardEnv(undefined)).toBeNull();
    expect(parseBoardEnv("")).toBeNull();
    expect(parseBoardEnv("  ,  , ")).toBeNull();
  });

  it("splits, trims, and lowercases tokens", () => {
    expect(parseBoardEnv("Stripe, Figma , DATABRICKS")).toEqual([
      "stripe",
      "figma",
      "databricks",
    ]);
  });
});

describe("curated boards", () => {
  it("has non-empty, de-duplicated token lists", () => {
    expect(GREENHOUSE_BOARDS.length).toBeGreaterThan(10);
    expect(LEVER_BOARDS.length).toBeGreaterThan(5);
    expect(new Set(GREENHOUSE_BOARDS).size).toBe(GREENHOUSE_BOARDS.length);
    expect(new Set(LEVER_BOARDS).size).toBe(LEVER_BOARDS.length);
  });
});
