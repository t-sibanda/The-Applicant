import { describe, expect, it } from "vitest";
import {
  ApplicationStatus,
  ApplicationTransitions,
  TERMINAL_APPLICATION_STATUSES,
} from "./constants";

describe("application status transitions", () => {
  it("defines a transition list for every status", () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(ApplicationTransitions).toHaveProperty(status);
      expect(Array.isArray(ApplicationTransitions[status])).toBe(true);
    }
  });

  it("terminal states (offer, rejected) have no outgoing transitions", () => {
    for (const status of TERMINAL_APPLICATION_STATUSES) {
      expect(ApplicationTransitions[status]).toEqual([]);
    }
  });

  it("rejected is reachable from every non-terminal status", () => {
    for (const status of Object.values(ApplicationStatus)) {
      if (TERMINAL_APPLICATION_STATUSES.includes(status)) continue;
      expect(ApplicationTransitions[status]).toContain(ApplicationStatus.REJECTED);
    }
  });

  it("only transitions to known statuses", () => {
    const all = new Set<string>(Object.values(ApplicationStatus));
    for (const targets of Object.values(ApplicationTransitions)) {
      for (const t of targets) expect(all.has(t)).toBe(true);
    }
  });
});
