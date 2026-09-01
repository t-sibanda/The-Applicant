import { useSyncExternalStore } from "react";

/**
 * The working session is the current job the user is applying to. It carries
 * across pages (Jobs -> AI Optimizer -> Applications) so nothing is pasted
 * twice. It lives only on the client, persisted to localStorage, so clearing
 * it never touches saved server data.
 */
export type WorkingScan = {
  match: number;
  suggestionText: string;
  matchedKeywords: string[];
  missingKeywords: string[];
};

export type WorkingSession = {
  jobUrl?: string;
  jobDescription?: string;
  companyName?: string;
  jobTitle?: string;
  scan?: WorkingScan;
  updatedAt: number;
} | null;

const KEY = "ta.workingSession";

let current: WorkingSession = load();
const listeners = new Set<() => void>();

function load(): WorkingSession {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as WorkingSession;
    return null;
  } catch {
    // Tolerate corrupt storage; a bad entry must never break a page.
    return null;
  }
}

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    // Ignore quota or serialization errors.
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getWorkingSession(): WorkingSession {
  return current;
}

/**
 * Merge a partial update into the working session. Passing a new job replaces
 * the prior context so stale data is not carried forward.
 */
export function setWorkingSession(patch: Partial<NonNullable<WorkingSession>>): void {
  current = { ...(current ?? {}), ...patch, updatedAt: Date.now() };
  persist();
  emit();
}

/** Replace the whole session with a fresh job context. */
export function startWorkingSession(patch: Partial<NonNullable<WorkingSession>>): void {
  current = { ...patch, updatedAt: Date.now() };
  persist();
  emit();
}

/** Clear the working session. Does not touch any saved server data. */
export function clearWorkingSession(): void {
  current = null;
  persist();
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: re-renders when the working session changes. */
export function useWorkingSession(): WorkingSession {
  return useSyncExternalStore(subscribe, getWorkingSession, getWorkingSession);
}
