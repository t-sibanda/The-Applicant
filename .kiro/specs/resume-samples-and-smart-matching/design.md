# Design Document

## Overview

This design turns the six requirement areas into concrete, low risk changes on the existing stack. It reuses tables and endpoints that already exist wherever possible, adds one label column to `resume_versions`, one client side working session store, one small backend "match chat" endpoint, and a smarter keyword extractor inside `api/services/ats.ts`.

The guiding principle is minimal surface area: the base resume stays the single default, `resume_versions` becomes the home for named samples, and a client store (persisted to localStorage) becomes the single carrier for the active job across pages. Nothing new is scraped, nothing is auto submitted.

## Architecture

```
Jobs page ──scan──> jobs.quickScan ──┐
   │                                 │ writes
   │ (match panel + match chat)      ▼
   │                          WorkingSession store (client, localStorage)
   │                                 │ read by
   ▼                                 ├──> Optimizer page (prefills job desc/company/title)
jobs.matchChat (new)                 └──> Applications page (log against same job)
   │
   ▼
AI service (chatCompletion) with job text + resume + profile as context

Resume page ──save sample──> resume.createVersion (label added)
            ──list──────────> resume.listVersions
            ──promote────────> resume.promoteVersion (new)
            ──delete─────────> resume.deleteVersion (new)

ATS: analyzeAts ──> extractKeywords (smarter: strips company names, proper nouns, keeps skills)
```

## Components and Interfaces

### 1. Named resume samples and versioning

**Schema change.** Add a `label` column to `resume_versions`:

```ts
// db/schema.ts, resume_versions table
label: varchar("label", { length: 120 }),
```

A Drizzle migration is generated and applied with the IPv4 safe applier.

**Backend (`api/routers/resume.ts`).**

- `createVersion` gains an optional `label: z.string().max(120)`. Stored on insert.
- New `promoteVersion({ versionId })`: verifies ownership through the parent resume profile, copies the version's `tailoredResumeText` into the owning profile's `baseResumeText`, leaves the version row intact.
- New `deleteVersion({ versionId })`: verifies ownership, deletes only that version.
- `listVersions` already returns rows ordered by `createdAt desc`; it now includes `label`.

Ownership is always verified by joining back to `resumeProfiles.userId === ctx.user.id`, matching the existing pattern in the router.

**Frontend (`src/pages/Resume.tsx`).**

- The "Saved documents" section becomes "Saved resume samples": each row shows `label` (falling back to `jobRef` then created date), View, Download, Promote to base, and Delete.
- A "Save current resume as a sample" action prompts for a label and calls `createVersion` with the current base text. Saving the base resume via `save()` is unchanged and never touches versions (already true today, restated as a guarantee).

### 2. Redundancy cleanup

This is primarily an audit plus consolidation, captured as tasks. The audit output lives in the design here so implementation is unambiguous.

**Findings from reading the pages:**

- **Voice sample / voice profile** appears on both the Resume page (`analyzeAndSaveVoice`) and the Voice page. Source of truth: the Voice page. The Resume page's voice block becomes a compact read only status ("Voice profile: Active") with a link to the Voice page, rather than a second capture form.
- **Resume import / curate from paste** ("Import from LinkedIn or paste details") lives on the Resume page and overlaps conceptually with the Optimizer's tailor flow. Keep import on Resume (it feeds the base resume). No change needed beyond confirming it does not duplicate the Optimizer's job specific tailoring.
- **Persona / personality** (personaJson, personalityJson) is captured through Voice/Growth. The Resume page must not collect these; confirm it does not.
- **Job description input** is captured on Jobs (paste box) and Optimizer (job description textarea). These converge via the working session (Requirement 4): Optimizer prefills from the session instead of being a separate silo.

The consolidation rule: each field has one capture point; other pages read only or deep link.

### 3. Job match chatbot side by side

**Backend (`api/routers/jobs.ts`).** Add `matchChat`:

```ts
matchChat: authedProcedure
  .input(z.object({
    jobText: z.string().min(1).max(16000),
    jobTitle: z.string().max(300).optional(),
    question: z.string().min(1).max(2000),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).max(20).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // gated by requireAIEntitlement
    // builds messages: system with resume + profile targeting + job text,
    // then history, then the new question. Calls chatCompletion.
    // returns { success, content, error }
  })
```

The system prompt gives the model the user's base resume, the active profile's target role/industry, and the pasted job text, and instructs it to answer only about fit for this job, honestly, no invented numbers.

**Frontend (`src/pages/Jobs.tsx`).** The existing scan result panel already shows match %, verdict, covered and missing keywords, curate action, and "Open in AI Optimizer". Extend it with a small chat area beneath: a scrollable message list plus an input that calls `matchChat` with `scan.jobText`, `scan.title`, and the running history. The "no resume" prompt (Requirement 3.4) already exists and stays.

### 4. Cross page carry over

**Client store (`src/lib/workingSession.ts`, new).** A tiny store (Zustand if already a dependency, otherwise a small custom store with `useSyncExternalStore`) persisted to localStorage under `ta.workingSession`:

```ts
type WorkingSession = {
  jobUrl?: string;
  jobDescription?: string;
  companyName?: string;
  jobTitle?: string;
  scan?: { match: number; suggestionText: string; matchedKeywords: string[]; missingKeywords: string[] };
  updatedAt: number;
} | null;
```

API: `getWorkingSession()`, `setWorkingSession(partial)`, `clearWorkingSession()`, and a `useWorkingSession()` hook.

**Wiring.**
- Jobs page: on successful scan (paste or job card), call `setWorkingSession` with url/description/company/title/scan. Selecting a different job replaces it (Requirement 4.4).
- Optimizer page: on mount, if a session exists, prefill `jobDescription`, `companyName`, `jobTitle` from it. If none, behave as today (Requirement 4.6).
- Applications page / Optimizer log action: when logging an application after generating a draft, use the session's company/title/url so nothing is re entered.
- Persistence to localStorage covers reload (Requirement 4.5).

I will check `package.json` for Zustand before choosing the implementation; the custom `useSyncExternalStore` store is the fallback so no new dependency is forced.

### 5. Global clear control

**Frontend (`src/components/AppLayout.tsx`).** Add a small "Clear working session" control in the layout (near the sidebar footer or header). On click it opens a confirm dialog (Requirement 5.2). On confirm it calls `clearWorkingSession()`, which resets the client store and localStorage. It does not call any delete endpoints, so saved data is untouched (Requirement 5.3). After clearing, pages reading the session naturally return to empty state (Requirement 5.4).

### 6. Smarter, more objective ATS scoring

**File: `api/services/ats.ts`.** The change is contained in `extractKeywords` and its helpers; the weighted scoring and the returned breakdown stay the same (Requirement 6.5).

Approach:

1. **Expanded stopword and generic filler set.** Add common job posting filler (for example "responsibilities", "requirements", "candidate", "opportunity", "company", "benefits").
2. **Company / proper noun handling.** Before lowercasing, detect capitalized tokens that are not sentence initial and not in a known skills list. Treat these as candidate proper nouns and down weight or drop them. The hiring company name, when derivable from the input (title or a "company" hint), is added to an exclusion set so it never counts (Requirement 6.3).
3. **Skills allow list.** A maintained `SKILL_TERMS` set (common tools, languages, frameworks, methodologies) is treated as guidance. Tokens in it are boosted. Tokens containing technical symbols like `+` or `#` (c++, c#) always survive filtering (Requirement 6.7).
4. **Weighting.** Frequency ranking is combined with a skill weight so recognized skills rank above generic terms of equal frequency (Requirement 6.4).
5. **Determinism.** All steps are pure functions of the input text plus static reference sets, so the same input yields the same keywords (Requirement 6.6). Ties are broken by a stable secondary sort (alphabetical) to avoid Map insertion order surprises.

New helper signatures:

```ts
function isLikelyProperNoun(rawToken: string, isSentenceStart: boolean): boolean;
function skillWeight(token: string): number; // >1 for known skills, 1 default
export function extractKeywords(jd: string, opts?: { companyHint?: string; max?: number }): string[];
```

`keywordCoverage` and `analyzeAts` pass an optional `companyHint` through when the caller has one (for example the job title or company field on a paste). Existing callers keep working because the parameter is optional.

## Data Models

Only one additive column:

- `resume_versions.label varchar(120) null`

No other schema changes. The working session is client only (localStorage), which keeps the clear control simple and avoids server state to purge.

## Error Handling

- `promoteVersion` / `deleteVersion`: throw `NOT_FOUND` when the version is not owned by the caller, matching the router's existing style.
- `matchChat`: gated by `requireAIEntitlement`; returns `{ success: false, error }` on AI failure so the UI can toast without crashing.
- Working session: reads tolerate malformed localStorage (try/catch returns null), so a corrupt entry never breaks a page.
- ATS: keyword extraction never throws on empty input; returns an empty list, preserving current behavior.

## Testing Strategy

- **Unit (Vitest):** extend the ATS tests to assert that a known company name in a job description is not returned as a keyword, that stopwords/filler are excluded, that skill tokens outrank generic tokens, and that `c++`/`c#` survive. Assert determinism by running extraction twice and comparing.
- **Unit:** working session store: set, get, clear, and malformed localStorage recovery.
- **Backend:** `promoteVersion` copies text into base resume and leaves the version; `deleteVersion` removes only the target; ownership checks reject other users.
- **Manual smoke:** scan a pasted job, ask a match chat question, open in Optimizer (prefilled), log to Applications, then use the global clear and confirm saved data remains.
- Keep the full suite green (currently 42 tests) plus the new cases. Run `tsc -b`, `npm test`, and `npm run build` before each push.

## Correctness Properties

These are invariants the implementation must uphold, and they map directly to the acceptance criteria.

### Property 1: Base resume isolation

Saving, editing, promoting, or deleting a resume sample never mutates or removes the base resume, except `promoteVersion`, which only copies into it.

**Validates: Requirements 1.4, 1.5, 1.6**

### Property 2: Sample durability

A saved sample persists until the user explicitly deletes it; base resume edits leave every sample intact.

**Validates: Requirements 1.6**

### Property 3: Single source of truth

No field is captured on two pages after cleanup; duplicated inputs become read only or links, and no saved data is lost during consolidation.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: Match context fidelity

The match chat answers using only the pasted job text plus the user's own resume and profile, and invents no metrics.

**Validates: Requirements 3.3**

### Property 5: Session freshness

The working session always reflects the most recently scanned or selected job; switching jobs replaces prior context.

**Validates: Requirements 4.1, 4.4**

### Property 6: Non destructive clear

Clearing the working session removes only client working state and never deletes saved resumes, samples, applications, or profile data.

**Validates: Requirements 5.1, 5.3**

### Property 7: ATS objectivity and determinism

The hiring company name and non skill proper nouns never appear in the extracted keyword set, recognized skills outrank generic terms, and identical input yields identical keywords.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

### Property 8: Backward compatibility

All new endpoint parameters and the new schema column are optional or nullable, so existing callers and existing rows keep working unchanged.

**Validates: Requirements 4.6**

## Rollout / migration notes

- Generate the migration with `npm run db:generate`, then apply with `node scripts/apply-sql.mjs api/db/migrations/<file>.sql`.
- The `label` column is nullable, so existing rows are unaffected and old samples display via the fallback label.
- No env, auth, or billing changes.
