import { describe, it, expect, beforeEach, vi } from "vitest";

// A minimal in-memory localStorage so the store's persistence path runs under
// the node test environment (there is no jsdom configured).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.resetModules();
});

async function freshStore() {
  // Import after stubbing so module-load state reads our storage.
  return await import("./workingSession");
}

describe("workingSession store", () => {
  it("starts empty when storage has nothing", async () => {
    const s = await freshStore();
    expect(s.getWorkingSession()).toBeNull();
  });

  it("sets and reads a partial update", async () => {
    const s = await freshStore();
    s.setWorkingSession({ jobTitle: "Product Manager", companyName: "Acme" });
    const got = s.getWorkingSession();
    expect(got?.jobTitle).toBe("Product Manager");
    expect(got?.companyName).toBe("Acme");
    expect(typeof got?.updatedAt).toBe("number");
  });

  it("merges partial updates", async () => {
    const s = await freshStore();
    s.setWorkingSession({ jobTitle: "PM" });
    s.setWorkingSession({ companyName: "Acme" });
    const got = s.getWorkingSession();
    expect(got?.jobTitle).toBe("PM");
    expect(got?.companyName).toBe("Acme");
  });

  it("startWorkingSession replaces prior context on a new job", async () => {
    const s = await freshStore();
    s.setWorkingSession({ jobTitle: "Old Job", jobDescription: "old" });
    s.startWorkingSession({ jobTitle: "New Job" });
    const got = s.getWorkingSession();
    expect(got?.jobTitle).toBe("New Job");
    expect(got?.jobDescription).toBeUndefined();
  });

  it("clears without leaving stored state", async () => {
    const s = await freshStore();
    s.setWorkingSession({ jobTitle: "PM" });
    s.clearWorkingSession();
    expect(s.getWorkingSession()).toBeNull();
    expect(localStorage.getItem("ta.workingSession")).toBeNull();
  });

  it("recovers from malformed localStorage", async () => {
    localStorage.setItem("ta.workingSession", "{not valid json");
    const s = await freshStore();
    // load() must not throw; it returns null on parse failure.
    expect(s.getWorkingSession()).toBeNull();
  });
});
