import { describe, it, expect } from "vitest";
import { entitlementsOf, requireAIEntitlement, tierOf } from "./entitlements";
import type { User } from "../db/schema";

function user(tier: string): User {
  return {
    id: 1,
    email: "a@b.c",
    passwordHash: "x:y",
    displayName: "A",
    role: "user",
    status: "active",
    subscriptionTier: tier,
    createdAt: new Date(),
    lastSignInAt: null,
  } as User;
}

describe("entitlements", () => {
  it("free tier does not include the AI optimizer", () => {
    expect(entitlementsOf(user("free")).aiOptimizer).toBe(false);
    expect(() => requireAIEntitlement(user("free"))).toThrow();
  });

  it("basic and pro tiers include the AI optimizer", () => {
    expect(entitlementsOf(user("basic")).aiOptimizer).toBe(true);
    expect(entitlementsOf(user("pro")).aiOptimizer).toBe(true);
    expect(() => requireAIEntitlement(user("pro"))).not.toThrow();
  });

  it("profile limits scale by tier", () => {
    expect(entitlementsOf(user("free")).maxProfiles).toBe(1);
    expect(entitlementsOf(user("pro")).maxProfiles).toBeGreaterThan(1);
  });

  it("defaults unknown tiers to free", () => {
    expect(tierOf(user("mystery"))).toBe("mystery");
    expect(entitlementsOf(user("mystery")).aiOptimizer).toBe(false);
  });
});
