import { describe, it, expect } from "vitest";
import { orderProviders, type ProviderConfig } from "./ai";

const primary: ProviderConfig = { apiUrl: "https://groq/x", apiKey: "g", model: "gpt-oss" };
const quality: ProviderConfig = { apiUrl: "https://openai/x", apiKey: "o", model: "gpt-4o" };
const fallback: ProviderConfig = { apiUrl: "https://openrouter/x", apiKey: "r", model: "auto" };

describe("orderProviders — task routing", () => {
  it("fast task leads with primary, then fallback", () => {
    const chain = orderProviders("fast", { primary, quality, fallback });
    expect(chain.map((p) => p.apiKey)).toEqual(["g", "r"]);
  });

  it("quality task leads with quality, then primary, then fallback", () => {
    const chain = orderProviders("quality", { primary, quality, fallback });
    expect(chain.map((p) => p.apiKey)).toEqual(["o", "g", "r"]);
  });

  it("quality falls back to primary when no quality provider is set", () => {
    const chain = orderProviders("quality", { primary, quality: null, fallback });
    expect(chain.map((p) => p.apiKey)).toEqual(["g", "r"]);
  });

  it("no task behaves like fast (primary then fallback)", () => {
    const chain = orderProviders(undefined, { primary, quality, fallback });
    expect(chain.map((p) => p.apiKey)).toEqual(["g", "r"]);
  });

  it("de-duplicates identical providers so none is called twice", () => {
    // Quality points at the same endpoint/key/model as primary.
    const chain = orderProviders("quality", { primary, quality: { ...primary }, fallback: null });
    expect(chain).toHaveLength(1);
    expect(chain[0].apiKey).toBe("g");
  });

  it("returns empty when nothing is configured", () => {
    expect(orderProviders("fast", { primary: null, quality: null, fallback: null })).toEqual([]);
  });
});
