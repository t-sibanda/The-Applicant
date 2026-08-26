import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
} from "./auth";

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toContain(":");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });

  it("produces different hashes for the same password (unique salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toEqual(b);
  });
});

describe("session tokens", () => {
  it("signs and verifies a session", async () => {
    const token = await signSession({ userId: 42, role: "user" });
    const claims = await verifySession(token);
    expect(claims).toEqual({ userId: 42, role: "user" });
  });

  it("returns null for a tampered/invalid token", async () => {
    expect(await verifySession("garbage.token.value")).toBeNull();
  });
});
