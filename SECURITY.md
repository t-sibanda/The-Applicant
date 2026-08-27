# The Applicant — Security Report

**Application:** The Applicant (AI-powered job-hunt platform)
**Report date:** 2026-08-27
**Scope:** All points of exposure — source repository, client (browser), API,
database, third-party integrations, secrets management, and deployment.

---

## 1. Executive summary

The Applicant is a single-origin full-stack TypeScript SaaS (React SPA + Hono/tRPC
API + PostgreSQL) deployed on Render, with data in Supabase. A full audit of every
exposure surface found **no secrets exposed to users or the internet**:

- No secrets in the git repository or its history.
- No secrets bundled into the browser/client JavaScript.
- No secrets or password hashes returned by any API response.
- All credentials isolated to server-side environment variables.

Hardening was applied to redact error detail in production and to broaden secret
exclusion rules. The remaining residual risk is operational key hygiene
(rotation and dashboard 2FA), documented in Section 10.

**Overall posture: strong for a small SaaS.**

---

## 2. Architecture & trust boundaries

```
Browser (untrusted)
  │  HTTPS / TLS
  ▼
Render — single Node service (trusted compute)
  ├─ Serves the built React SPA (static, no secrets)
  ├─ /api/trpc/*  (typed API, auth-guarded)
  ├─ /api/health  (status only, no secret values)
  ├─ /api/stripe/webhook (signature-verified)
  └─ /api/files/* (per-user access control)
  │  server-to-server, HTTPS, keys held server-side only
  ▼
Supabase PostgreSQL · Groq (AI) · Stripe (payments) · Job-source APIs · Supabase Storage
```

**Key principle:** the browser only ever talks to our own origin. All third-party
API keys live on the server and are never transmitted to the client.

---

## 3. Secrets management

| Control | Status |
|---|---|
| Secrets stored only in environment variables (Render dashboard + local `.env`) | ✅ |
| `.env` excluded from git (gitignored since first commit) | ✅ |
| `.env` never committed at any point in git history (verified) | ✅ |
| Only `.env.example` (placeholders) is tracked | ✅ |
| `.gitignore` covers `.env.*`, `*.pem`, `*.key`, `credentials.json`, data exports | ✅ |
| Server env module (`api/lib/env.ts`) never imported by client code | ✅ |
| No `process.env` usage in client (`src/`) | ✅ |
| Fail-fast: required vars validated at boot in production | ✅ |

**Secrets inventory (all server-side only):** `DATABASE_URL`, `SESSION_SECRET`,
`AI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_KEY`,
`JOBS_ADZUNA_APP_KEY`, `JOBS_USAJOBS_API_KEY`, `ADMIN_PASSWORD`.

---

## 4. Repository exposure

- **Git history scanned** for real key patterns (`gsk_…`, `sk_live/test_…`,
  `whsec_…`), database passwords, and the Adzuna key — **none found** in any commit.
- Tracked files matching secret-like words contain only **placeholders** in
  `.env.example` or **code references** (e.g. the word "password" in logic).
- The repository is **private** on GitHub.

---

## 5. Client / browser exposure

- Vite only exposes `VITE_`-prefixed variables to the client; **no secret uses a
  `VITE_` prefix.**
- The only client env reference is `import.meta.env.DEV` (a build flag).
- All AI/payment/DB/storage calls are made **server-side**; the browser receives
  only the resulting data, never the keys.

---

## 6. Authentication & session security

| Control | Detail |
|---|---|
| Password hashing | scrypt with a unique per-user salt (`salt:hash`) |
| No plaintext passwords | Never stored, logged, or returned |
| Sessions | Signed JWT (jose, HS256) in an **HttpOnly** cookie (JS cannot read it) |
| Cookie flags | `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` in production, 30-day max-age |
| Session secret | Long random `SESSION_SECRET` (server-only), separate from all other keys |
| Generic auth errors | Login failures don't reveal whether the email or password was wrong |
| Rate limiting | Login (10 / 15 min / IP) and registration (5 / 15 min / IP) |
| Suspended users | Cannot establish a session; treated as unauthenticated |

---

## 7. Authorization & access control

| Control | Detail |
|---|---|
| Tenant isolation | Every user-owned query is scoped to `userId`; users cannot read others' data |
| Role gating | `adminProcedure` guard rejects non-admins with FORBIDDEN on every admin endpoint |
| Feature entitlements | Server-enforced on each request (tier defaults + admin grants), never trusted from the client or cookie |
| Time-based grants | Stored in DB with `expiresAt`; expired grants ignored live (instantly revocable) |
| File access | Uploads namespaced per user (`users/<id>/…`); download rejects keys outside the caller's prefix |
| Password hash exposure | `publicUser()` and admin `listUsers` select explicit safe columns only — hash never returned |

---

## 8. API response hygiene

- **No API response includes** password hashes, session tokens, or environment secrets.
- `/api/health` returns connectivity status and **boolean** integration flags only
  (e.g. `"payments": true`) — never key values.
- **Production error redaction:**
  - Database errors are hidden in production (they can contain host/connection detail).
  - tRPC `INTERNAL_SERVER_ERROR`s return a generic message in production; no stack
    traces or internal detail reach clients. Intentional errors (Unauthorized,
    Forbidden, Conflict, etc.) keep their user-friendly messages.

---

## 9. Third-party integrations

| Integration | Security notes |
|---|---|
| Stripe (payments) | No card data stored; webhooks **signature-verified**; entitlement changes only via verified webhook; keys server-side |
| Groq (AI) | Key server-side; requests proxied by the server; model id is config (no hardcoded deprecation risk) |
| Supabase (DB + storage) | Service key server-side; TLS in transit; encryption at rest (Supabase default); app data isolated in a dedicated `applicant` schema |
| Job sources (Remotive, Adzuna, Arbeitnow, The Muse, USAJOBS) | Read-only, ToS-compliant official/public APIs; keys server-side; failures degrade gracefully and are logged |
| Browser extension (autofill) | Uses the user's own session (credentials) via scoped CORS; read-only payload; **fills on click, never auto-submits**; no scraping — ToS-safe |

---

## 10. Data protection & handling

- **In transit:** HTTPS/TLS enforced by Render and Supabase.
- **At rest:** Supabase encrypts stored data by default.
- **Untrusted input:** all API inputs validated with Zod; job-source data and file
  uploads treated as untrusted; path traversal blocked in file storage.
- **User data rights:** self-service **data export** (full JSON) and **account
  deletion** (password-confirmed, cascades all owned data).
- **PII footprint:** names, emails, resumes; scoped strictly to the owning user.

---

## 11. Deployment security

- **Single origin** by default — the SPA and API share an origin, so the app needs
  no broad CORS. A **narrow CORS allowance** exists only on `/api/trpc/*` so the
  autofill extension can call with credentials.
- Secrets set in the **Render dashboard** (`sync: false` in `render.yaml`) — not in
  the repo blueprint.
- Health check endpoint used for deploy readiness.

---

## 12. Residual risks & recommendations

These are operational, not code-level, exposures:

1. **Rotate keys shared during setup.** The Groq key, Adzuna key, and the Supabase
   database password were shared in the build chat. They are **not** in the repo,
   client, or API responses, but should be rotated as good hygiene:
   - Groq: regenerate at console.groq.com
   - Adzuna: regenerate in the Adzuna developer dashboard
   - Supabase: reset the database password
   - Update each in Render env vars and local `.env` after rotating.
   *(The Stripe live key was already rotated.)*
2. **Change the default admin password.** The seed default (`ADMIN_PASSWORD`) is
   insecure; set a strong value and change it via Account Settings after first login.
3. **Enable 2FA** on the Render, Supabase, Stripe, and GitHub accounts — dashboard
   access is now the highest-value target.
4. **Set a strong production `SESSION_SECRET`** (already generated during setup;
   confirm it's the long random value in Render, not the dev placeholder).
5. **Full "forgot password" (email reset)** is not yet built — currently admin-reset
   only. Add an email provider when ready for self-service resets.
6. **Rate limiting** is per-process/in-memory; for multi-instance scale, move to a
   shared store (e.g. Redis).
7. **Legal/compliance:** publish a privacy policy and terms of service before taking
   paying customers, given PII and payment handling.

---

## 13. Verification methods used

- `git ls-files` and `git check-ignore` to confirm `.env` exclusion.
- `git grep` and `git log -p --all` scans across the full history for real key
  patterns and known secret values — clean.
- Source review of client env usage (`import.meta.env`, `process.env`) — no leakage.
- Review of API response shapes (`publicUser`, admin queries, `/api/health`,
  tRPC error formatter) — no secret or hash leakage.
- Build + typecheck + test suite (19 tests) passing after hardening.

---

*This report reflects the state of the application at the report date. Re-audit
after significant changes to authentication, integrations, or data handling.*
