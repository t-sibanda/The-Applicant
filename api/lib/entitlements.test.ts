import { describe, it, expect } from "vitest";
import { entitlementsOf, tierOf } from "./entitlements";
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

describe("tier entitlements (base plan, pre-grant)", () => {
  it("free tier does not include the AI optimizer or auto-apply", () => {
    expect(entitlementsOf(user("free")).aiOptimizer).toBe(false);
    expect(entitlementsOf(user("free")).autoApply).toBe(false);
  });

  it("basic includes AI + semi-apply but not auto-apply", () => {
    const basic = entitlementsOf(user("basic"));
    expect(basic.aiOptimizer).toBe(true);
    expect(basic.semiApply).toBe(true);
    expect(basic.autoApply).toBe(false);
  });

  it("pro includes auto-apply with a daily cap", () => {
    const pro = entitlementsOf(user("pro"));
    expect(pro.autoApply).toBe(true);
    expect(pro.dailyAutoApplyCap).toBeGreaterThan(0);
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
