# The Applicant

A full-stack, AI-powered, multi-tenant job-hunt platform. One repo, one database,
one deploy target, one origin — designed for operational simplicity.

## Features

- **Accounts & multi-tenancy** — email/password auth (scrypt + JWT cookies), per-user data isolation.
- **Multiple profiles per user** — separate targeting contexts (industry/role/location); one active at a time; per-tier limits.
- **Admin console** — manage users (suspend/reactivate, change tier), handle support requests. Admin-only.
- **Subscriptions & payments** — Stripe Checkout + webhooks, feature-flagged (runs "billing disabled" without keys).
- **Compliant job sourcing** — pulls from ToS-compliant APIs (Remotive public API out of the box; Adzuna/USAJOBS via keys). Dedupes and logs.
- **Employer quality scoring** — flags above-median comp, combines culture/retention signals, marks unrated when data is missing (never fabricates).
- **Resume builder & versioning** — structured base resume, tailored versions.
- **Voice profiles** — analyze writing samples; AI writes in the applicant's voice.
- **AI optimizer** — parse job, tailor resume, cover letter, ATS score, career chat, interview questions. Model id is config-driven.
- **Application tracking & dashboard** — pipeline statuses and metrics.
- **Notifications** — in-app events.
- **Cloud storage** — S3-compatible with local fallback.

## Architecture

- **Frontend:** React + Vite + React Router + TanStack Query + Tailwind, typed via tRPC.
- **Backend:** Hono + tRPC + Drizzle ORM + PostgreSQL.
- **Single origin:** in production the Hono server serves both the API and the built SPA — no CORS.
- **Provider-agnostic adapters:** AI, storage, job sources, and payments each sit behind one interface and disable gracefully when unconfigured.

## Getting started

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, SESSION_SECRET, AI_API_KEY, etc.
npm run db:generate       # generate migration from schema (first time)
node scripts/apply-sql.mjs api/db/migrations/<file>.sql   # apply (IPv4-safe)
npm run db:seed           # create the bootstrap admin
npm run dev               # http://localhost:3000
```

## Scripts

- `npm run dev` — dev server (SPA + API on one origin)
- `npm run build` — build SPA + bundle server
- `npm start` — run production server (serves SPA + API)
- `npm run check` — typecheck
- `npm test` — run tests
- `npm run db:generate | db:migrate | db:push | db:seed` — database workflow

## Configuration

All config is in environment variables — see `.env.example`. Required in production:
`DATABASE_URL`, `SESSION_SECRET`. Everything else is optional; the related feature
disables gracefully when its keys are absent.

- **DB:** use a pooled / IPv4-friendly Postgres URL (the app forces IPv4 to avoid the Supabase IPv6/ENOTFOUND issue). Tables live in a dedicated `applicant` schema so they never collide with other apps in the same database.
- **AI:** `AI_API_KEY` + `AI_MODEL` (Groq default). Model id is config so a provider deprecation is a config change, not a code change.
- **Payments:** use **test** Stripe keys while building (`sk_test_`/`pk_test_`). Add a webhook endpoint at `/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`.

## Compliance note

Job sourcing uses only ToS-compliant sources (official/public/aggregator APIs). No
source that prohibits automated access is included. Add new compliant sources as
adapters in `api/services/job-sources.ts`.

## Deployment

Build and run as a single service (Render, Railway, Fly, a container, etc.):

```bash
npm run build
npm start        # NODE_ENV=production; serves SPA + API on $PORT
```

Set the environment variables in your host's dashboard. Because the SPA and API
share one origin, no CORS configuration is required.
