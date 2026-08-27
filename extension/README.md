# The Applicant — Autofill Extension

A Manifest V3 browser extension that fills job application forms with your saved
profile and AI-tailored materials. **It only fills fields when you click, and it
never submits** — you review and submit yourself. This keeps within job sites'
terms of service and avoids the account-ban risk of headless auto-apply.

## Install (developer mode)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.

## Use
1. Sign in to The Applicant in a normal browser tab.
2. Click the extension icon → enter your app URL → **Connect to my account**
   (it uses your signed-in session cookie; nothing is stored server-side).
3. On any application page, open the popup and click **Fill this page**.
4. **Review every field**, paste your tailored resume/cover letter (buttons copy
   them), then submit the form yourself.

## How it works / limits
- The popup fetches a read-only payload from `/api/trpc/extension.payload`
  (contact fields + latest tailored resume/cover letter) using your session.
- The content script matches common field names (name, email, phone, links) and
  fills them. ATS forms vary, so it fills what it can confidently identify —
  always review.
- No auto-submit, no background automation, no scraping. Human-in-the-loop by
  design.
