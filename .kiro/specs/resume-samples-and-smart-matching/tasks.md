# Implementation Plan

## Overview

This plan implements the six requirement areas in an order that lands low risk, high value wins first (smarter ATS, then samples), then the shared working session that the match chat, cross page carry over, and global clear all build on, and finishes with redundancy cleanup and a verify/ship step. Each task is small, testable, and keeps the build green.

## Tasks

- [x] 1. Smarter ATS keyword extraction
- [x] 1.1 Expand filler set and add skills reference in `api/services/ats.ts`
  - Add job posting filler terms to the stopword handling and introduce a `SKILL_TERMS` set of common tools, languages, frameworks, and methodologies.
  - Keep tokens containing technical symbols (`+`, `#`) always eligible.
  - _Requirements: 6.1, 6.7_

- [x] 1.2 Add proper noun and company name handling to `extractKeywords`
  - Detect capitalized non sentence initial tokens that are not known skills and down weight or drop them.
  - Accept an optional `companyHint`, derive an exclusion set from it, and never emit those tokens as keywords.
  - Combine frequency with a skill weight so recognized skills outrank generic terms, with a stable alphabetical tiebreak for determinism.
  - Thread the optional `companyHint` through `keywordCoverage` and `analyzeAts` without breaking existing callers.
  - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 1.3 Unit tests for smarter ATS
  - Assert a company name in a JD is not returned as a keyword, filler is excluded, skills outrank generic tokens, `c++`/`c#` survive, and extraction is deterministic across two runs.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 2. Named resume samples and versioning
- [x] 2.1 Add `label` column to `resume_versions` and migrate
  - Add `label varchar(120)` to the schema, run `db:generate`, and apply with the IPv4 safe applier.
  - _Requirements: 1.1, 1.2_

- [x] 2.2 Extend resume router with label, promote, and delete
  - Add optional `label` to `createVersion`; add `promoteVersion` (copies version text into base resume, leaves version intact) and `deleteVersion` (removes only the target), both with ownership checks.
  - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [x] 2.3 Backend tests for versioning invariants
  - Verify promote copies into base and preserves the version, delete removes only the target, and both reject non owners.
  - _Requirements: 1.4, 1.5, 1.6_

- [x] 2.4 Update Resume page saved samples UI
  - Rename to "Saved resume samples", show label with fallback, add Save as sample (prompts label), Promote to base, and Delete; confirm base save never touches versions.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 3. Working session store and cross page carry over
- [x] 3.1 Create the working session store
  - Add `src/lib/workingSession.ts` with get/set/clear and a `useWorkingSession` hook, persisted to localStorage with tolerant parsing. Check `package.json` for Zustand first; otherwise use `useSyncExternalStore`.
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 3.2 Write from the Jobs page on scan and selection
  - On successful paste scan and job card scan, populate the session; selecting a different job replaces prior context.
  - _Requirements: 4.1, 4.4_

- [x] 3.3 Read into the Optimizer and Applications flows
  - Prefill Optimizer job description, company, and title from the session when present; otherwise keep manual behavior. Reuse session company/title/url when logging an application.
  - _Requirements: 4.2, 4.3, 4.6_

- [x] 3.4 Unit tests for the working session store
  - Cover set, get, clear, replacement on new job, and recovery from malformed localStorage.
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 4. Job match chatbot side by side
- [x] 4.1 Add `matchChat` endpoint to the jobs router
  - AI gated endpoint that answers fit questions using resume, profile targeting, and the pasted job text, with short history; returns `{ success, content, error }`.
  - _Requirements: 3.2, 3.3_

- [x] 4.2 Extend the Jobs scan panel with the match chat
  - Add a message list and input beneath the existing match panel, calling `matchChat` with `scan.jobText`, title, and running history. Keep the no resume prompt and the curate / open in Optimizer actions.
  - _Requirements: 3.1, 3.4, 3.5, 3.6_

- [x] 5. Global clear control
- [x] 5.1 Add clear control with confirmation to AppLayout
  - Add a "Clear working session" control that confirms first, then calls `clearWorkingSession()`; it must not call any delete endpoints so saved data is preserved.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Redundancy cleanup
- [x] 6.1 Consolidate the Resume page voice block to read only
  - Replace the Resume page voice capture with a read only status and a link to the Voice page; keep the base resume, import, and samples sections. Confirm no persona/personality capture leaks onto Resume.
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 6.2 Verify no duplicate job description capture after carry over
  - Confirm the Optimizer sources its job context from the working session rather than acting as a separate silo, per section 4 wiring.
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Verify and ship
  - Run `tsc -b`, `npm test`, and `npm run build`; fix any failures. Commit and push to trigger the Render deploy.
  - _Requirements: 2.5_

## Task Dependency Graph

Tasks are grouped into waves. Tasks in the same wave have no dependencies on each other and can be done in parallel. Each wave depends on the ones before it.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "2.1", "3.1"],
      "description": "Independent foundations: ATS filler/skills set, schema label column, working session store."
    },
    {
      "wave": 2,
      "tasks": ["1.2", "2.2", "3.2", "3.4", "4.1", "5.1"],
      "description": "Build on foundations: ATS extraction, versioning endpoints, session writes, session tests, match chat endpoint, clear control."
    },
    {
      "wave": 3,
      "tasks": ["1.3", "2.3", "2.4", "3.3", "4.2"],
      "description": "Tests and UI: ATS tests, versioning tests, samples UI, carry over reads, match chat UI."
    },
    {
      "wave": 4,
      "tasks": ["6.1", "6.2"],
      "description": "Redundancy cleanup, dependent on samples UI and carry over wiring."
    },
    {
      "wave": 5,
      "tasks": ["7"],
      "description": "Verify and ship."
    }
  ]
}
```

- Group 1 (ATS) is independent and can ship first.
- Group 2 (samples) is independent of group 1.
- Task 3.1 (working session store) is the shared foundation for 3.2 to 3.4, 4.1 to 4.2, and 5.1.
- Group 6 (cleanup) depends on the sample UI (2.4) and the carry over wiring (3.3).
- Task 7 (verify and ship) runs last, after everything else.

## Notes

- No LinkedIn scraping and no headless auto apply; anything leaving the app stays human in the loop.
- No fabricated metrics; all shown numbers come from real input.
- The only schema change is the nullable `resume_versions.label` column, applied via the IPv4 safe applier (`node scripts/apply-sql.mjs`).
- Node runs from `C:\Program Files\nodejs\`; prefix commands with the PATH export and use the full paths per project convention.
- Copy stays in the plain, warm project voice with no em dashes.

