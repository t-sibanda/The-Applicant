# The Applicant — Fit Check (browser extension)

A read-only companion that checks your fit for a job you are viewing on
LinkedIn or a careers page, using your saved profile in The Applicant.

## What it does

- Adds a floating "Check my fit" button on job postings.
- On your click, it reads the job text already visible on the page and asks The
  Applicant to score your fit against your saved resume and profile.
- Shows your match score, the keywords you already cover, and what is worth
  adding, plus a link to tailor your documents in the app.

## What it does not do

- It never edits the page, never messages anyone, and never applies for you.
- It does not read or change your LinkedIn account or scrape profiles.
- It only acts when you click, and only reads what is on screen.

This keeps it within LinkedIn's and other sites' terms of use.

## Install (developer mode)

1. Open your app in the browser and sign in to The Applicant.
2. Go to `chrome://extensions` (or your browser's extensions page).
3. Turn on Developer mode.
4. Click "Load unpacked" and select this `extension/` folder.
5. Click the extension icon and paste your app URL (for example your Render
   URL). Save.
6. Open a job on LinkedIn (or Greenhouse/Lever/Ashby/Indeed) and click
   "Check my fit".

## Notes

- You must be signed in to The Applicant in the same browser; the extension
  uses your existing session cookie over HTTPS.
- The app already allows this via CORS on `/api/trpc/*` with credentials.
- Works in Chrome/Edge (Manifest V3). Firefox support needs a small manifest
  tweak (background/service worker differences).
