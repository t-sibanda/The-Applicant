# Requirements Document

## Introduction

This feature set solves a group of connected pain points a job seeker hits while using The Applicant day to day. Resumes get lost when the base resume is repeatedly overwritten, so the user cannot keep tailored samples for different roles. Several pages (Resume, ProfileHub, Voice) overlap and ask for the same information more than once. When a user pastes a job link, they want a side by side match view and a smooth handoff into the AI Optimizer without re pasting anything. They also want a single control to clear their working state, and they want the ATS scoring to stop treating company names and other noise as skills.

The work is grouped into six areas:

1. Named resume samples and versioning (stop losing resumes on update).
2. Redundancy cleanup across Resume, ProfileHub, and Voice.
3. Job match chatbot shown side by side when a job link or description is pasted.
4. Cross page carry over of the working job and documents (Jobs to Optimizer to Applications) without re pasting.
5. A global clear control for the working session.
6. Smarter, more objective ATS scoring that ignores company names and irrelevant words.

The change stays within the existing stack (Vite + React SPA, Hono/tRPC API, Drizzle/Postgres in the `applicant` schema). It stays ToS safe (no LinkedIn scraping, human in the loop for anything that leaves the app) and honest about limits.

## Glossary

- **Base resume**: the single default resume text stored on a resume profile.
- **Resume sample**: a named, saved resume the user keeps for a role type (for example "Product Manager" or "Data Analyst"). Backed by the existing `resume_versions` table, extended with a label.
- **Working session**: the current job context (URL, description, company, title, match scan, drafts) that carries across pages during a single job application flow.
- **Match scan**: the deterministic + AI read of how well the user's resume fits a job, already produced by `jobs.quickScan`.

---

## Requirements

### Requirement 1: Named resume samples and versioning

**User Story:** As a job seeker, I want to save and name multiple resume samples for different roles, so that updating one resume never loses the others.

#### Acceptance Criteria

1. WHEN the user saves a resume sample THEN the system SHALL store it as a resume version with a user provided label without altering the base resume.
2. WHEN the user views their saved documents THEN the system SHALL list every saved resume sample with its label, an optional job reference, and its created date.
3. WHEN the user opens a saved resume sample THEN the system SHALL display its full content and allow the user to download it.
4. WHEN the user chooses to promote a resume sample to the base resume THEN the system SHALL copy the sample content into the base resume and SHALL leave the sample record intact.
5. WHEN the user deletes a resume sample THEN the system SHALL remove only that version and SHALL leave the base resume and other samples unchanged.
6. WHEN the user edits and saves the base resume THEN the system SHALL NOT delete or overwrite any existing resume samples.
7. IF a resume sample has no label THEN the system SHALL display a sensible default label derived from its job reference or created date.

### Requirement 2: Redundancy cleanup across pages

**User Story:** As a user, I want each piece of information asked for once, so that I do not repeat myself across Resume, Profile, and Voice pages.

#### Acceptance Criteria

1. WHEN the codebase is audited THEN the system SHALL have a documented list of every duplicated input, section, and endpoint across the Resume, ProfileHub, and Voice pages.
2. WHERE the same field or section exists on more than one page THEN the system SHALL keep a single source of truth and SHALL have the other pages read from or link to it rather than collect it again.
3. WHEN a field lives on one page THEN other pages that need the same value SHALL display it read only or SHALL link to the owning page instead of duplicating the input.
4. WHEN redundancy is removed THEN the system SHALL preserve all existing saved data (no data loss for base resume, voice profile, persona, or personality results).
5. WHEN the cleanup is complete THEN the system SHALL keep the typecheck, tests, and build passing.

### Requirement 3: Job match chatbot side by side

**User Story:** As a user, when I paste a job link or description, I want a match chatbot beside it that compares my profile and resume to the job, so that I understand my fit before curating documents.

#### Acceptance Criteria

1. WHEN the user pastes a job link or description and runs a scan THEN the system SHALL show a match panel with the match percentage, a plain language verdict, covered keywords, and worth adding keywords.
2. WHEN the match panel is shown THEN the system SHALL offer a conversational area where the user can ask follow up questions about their fit for that job.
3. WHEN the user asks a follow up question in the match chat THEN the system SHALL answer using the pasted job text and the user's resume and profile as context.
4. IF the user has no resume saved THEN the system SHALL still show the match panel and SHALL prompt the user to add a resume for a sharper match.
5. WHEN the match panel is shown THEN the system SHALL provide an action to curate documents and an action to open the same job in the AI Optimizer.
6. WHEN the user starts working on documents from the match panel THEN the system SHALL carry the job context forward without asking the user to paste it again (see Requirement 4).

### Requirement 4: Cross page carry over

**User Story:** As a user, I want the job I am working on to follow me from Jobs to the AI Optimizer to Applications, so that I never paste the same job twice.

#### Acceptance Criteria

1. WHEN the user scans or selects a job THEN the system SHALL record it as the current working session (job URL, description, company, title, and match scan).
2. WHEN the user navigates from Jobs to the AI Optimizer THEN the system SHALL pre fill the job description, company, and title from the working session.
3. WHEN the user generates a tailored resume or cover letter in the Optimizer for the working session THEN the system SHALL make that draft available to log against the same job on the Applications page without re entry.
4. WHEN the working session changes to a different job THEN the system SHALL replace the previous working context so stale data is not carried forward.
5. WHERE the user reloads the page THEN the system SHALL restore the working session if one is active.
6. IF there is no active working session THEN the Optimizer and Applications pages SHALL behave exactly as they do today (manual entry).

### Requirement 5: Global clear control

**User Story:** As a user, I want a single control to clear my working state, so that I can start fresh whenever I want.

#### Acceptance Criteria

1. WHEN the user activates the clear control THEN the system SHALL clear the working session (current job, scan, and carried drafts) from the client.
2. WHEN the user activates the clear control THEN the system SHALL ask for confirmation before clearing, because the action is not undoable.
3. WHEN the working session is cleared THEN the system SHALL NOT delete saved data such as the base resume, resume samples, logged applications, or profile information.
4. WHEN the working session is cleared THEN the Jobs, Optimizer, and Applications pages SHALL return to their empty starting state for the working flow.
5. WHERE the clear control is placed THEN the system SHALL make it reachable from the main layout so it is available across pages.

### Requirement 6: Smarter, more objective ATS scoring

**User Story:** As a user, I want the ATS scoring to ignore company names and irrelevant words, so that my match reflects real skills and requirements.

#### Acceptance Criteria

1. WHEN keywords are extracted from a job description THEN the system SHALL exclude common stopwords, generic filler, and detected company or organization names.
2. WHEN a token appears to be a proper noun that is not a known skill or technology THEN the system SHALL down weight or exclude it from the keyword set.
3. WHEN the job description names the hiring company THEN the system SHALL NOT count that company name as a required keyword.
4. WHEN keyword coverage is computed THEN the system SHALL weight recognized skills, tools, and hard requirements above generic terms.
5. WHEN the ATS result is returned THEN the system SHALL keep the transparent breakdown (keyword coverage, format, seniority, hard requirements) so the score stays explainable.
6. WHEN the smarter extraction is applied THEN the system SHALL keep results deterministic for the same input so scores are reproducible.
7. IF a maintained skills or technology reference list is used THEN the system SHALL treat it as guidance, and SHALL still allow unknown but clearly technical tokens (for example tokens containing symbols like + or #) to count.

---

## Non goals

- No scraping of LinkedIn or any site that forbids it.
- No headless or automatic job application submission. Anything that leaves the app stays human in the loop.
- No fabricated metrics or scores. All numbers shown are computed from real input.
- No changes to billing, auth, or the deployment pipeline.

## Constraints

- Stay within the current stack and the `applicant` Postgres schema.
- Any new table or column ships with a Drizzle migration applied via the IPv4 safe applier.
- Typecheck, tests, and build must pass before each push.
- Copy stays in the plain, warm project voice with no em dashes.
