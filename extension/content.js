/**
 * The Applicant — Fit Check content script.
 *
 * Adds a floating "Check my fit" button on a job posting. On click it reads the
 * job text that is already visible on the page and asks The Applicant to score
 * your fit against your saved resume and profile. It is read-only: it never
 * edits the page, never auto-applies, and only acts when you click. It works as
 * a companion to LinkedIn and other sites within their terms of use.
 */
(function () {
  if (window.__taFitInjected) return;
  window.__taFitInjected = true;

  // ── Extract the visible job text and title from common layouts ──
  function getText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const t = el && el.innerText ? el.innerText.trim() : "";
      if (t && t.length > 40) return t;
    }
    return "";
  }

  function readJob() {
    const description = getText([
      // LinkedIn
      ".jobs-description__content",
      ".jobs-description-content__text",
      "#job-details",
      // Greenhouse / Lever / Ashby / Indeed and generic
      "#content .content",
      ".posting .section-wrapper",
      "._content_",
      ".jobsearch-JobComponent-description",
      "article",
      "main",
    ]);
    const title = getText([
      ".job-details-jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      ".posting-headline h2",
      "h1",
    ]);
    // Fallback: whole page text, trimmed, if nothing specific matched.
    const body = description || (document.body ? document.body.innerText.trim() : "");
    return {
      title: (title || document.title || "").slice(0, 300),
      description: body.slice(0, 16000),
    };
  }

  // ── Call The Applicant's tRPC endpoint (superjson wire format) ──
  async function quickScan(baseUrl, input) {
    const res = await fetch(`${baseUrl}/api/trpc/jobs.quickScan`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
    if (res.status === 401) throw new Error("Sign in to The Applicant in this browser first.");
    if (!res.ok) throw new Error(`Request failed (${res.status}).`);
    const data = await res.json();
    // superjson response: { result: { data: { json: <payload> } } }
    return data && data.result && data.result.data ? data.result.data.json : null;
  }

  function el(tag, attrs = {}, html) {
    const n = document.createElement(tag);
    Object.assign(n, attrs);
    if (html != null) n.innerHTML = html;
    return n;
  }

  function color(m) {
    return m >= 70 ? "#059669" : m >= 45 ? "#d97706" : "#e11d48";
  }

  function renderPanel(inner) {
    let panel = document.getElementById("ta-fit-panel");
    if (!panel) {
      panel = el("div", { id: "ta-fit-panel" });
      document.body.appendChild(panel);
    }
    panel.innerHTML = "";
    const close = el("button", { className: "ta-close", textContent: "\u00d7" });
    close.addEventListener("click", () => panel.remove());
    panel.appendChild(close);
    panel.appendChild(inner);
  }

  function showResult(scan, baseUrl) {
    const wrap = el("div");
    if (!scan || scan.ok === false) {
      wrap.appendChild(el("h3", { textContent: "Could not scan" }));
      wrap.appendChild(el("p", { className: "ta-err", textContent: (scan && scan.reason) || "No readable job text on this page. Open the full description and try again." }));
      renderPanel(wrap);
      return;
    }
    wrap.appendChild(el("h3", { textContent: "Your fit" }));
    wrap.appendChild(el("p", { className: "ta-sub", textContent: scan.suggestionText || "" }));
    const score = el("div", { className: "ta-score" });
    score.textContent = `${scan.match}%`;
    score.style.color = color(scan.match);
    wrap.appendChild(score);

    if (!scan.hasResume) {
      wrap.appendChild(el("p", { className: "ta-note", textContent: "Add your resume in The Applicant for a sharper match." }));
    } else {
      wrap.appendChild(el("div", { className: "ta-label", textContent: "You already cover" }));
      const have = el("div");
      (scan.matchedKeywords || []).slice(0, 12).forEach((k) => have.appendChild(el("span", { className: "ta-chip ta-have", textContent: k })));
      if (!(scan.matchedKeywords || []).length) have.textContent = "—";
      wrap.appendChild(have);

      wrap.appendChild(el("div", { className: "ta-label", textContent: "Worth adding" }));
      const miss = el("div");
      (scan.missingKeywords || []).slice(0, 12).forEach((k) => miss.appendChild(el("span", { className: "ta-chip ta-miss", textContent: k })));
      if (!(scan.missingKeywords || []).length) miss.textContent = "Nothing major";
      wrap.appendChild(miss);
    }

    const link = el("a", { href: `${baseUrl}/applications`, target: "_blank", textContent: "Tailor documents in The Applicant \u2192" });
    link.style.display = "inline-block";
    link.style.marginTop = "12px";
    wrap.appendChild(link);
    wrap.appendChild(el("p", { className: "ta-note", textContent: "Read-only companion. Nothing on this page was changed." }));
    renderPanel(wrap);
  }

  async function onClick() {
    const { baseUrl } = await chrome.storage.sync.get(["baseUrl"]);
    if (!baseUrl) {
      const wrap = el("div");
      wrap.appendChild(el("h3", { textContent: "Set your app URL" }));
      wrap.appendChild(el("p", { className: "ta-sub", textContent: "Open the extension icon and paste your app URL first." }));
      renderPanel(wrap);
      return;
    }
    const job = readJob();
    if (!job.description || job.description.length < 40) {
      showResult({ ok: false, reason: "Open the full job description on this page, then try again." }, baseUrl);
      return;
    }
    const loading = el("div");
    loading.appendChild(el("h3", { textContent: "Checking your fit\u2026" }));
    loading.appendChild(el("p", { className: "ta-sub", textContent: "Reading this posting against your saved profile." }));
    renderPanel(loading);
    try {
      const scan = await quickScan(baseUrl, { description: job.description, title: job.title });
      showResult(scan, baseUrl);
    } catch (e) {
      const wrap = el("div");
      wrap.appendChild(el("h3", { textContent: "Could not scan" }));
      wrap.appendChild(el("p", { className: "ta-err", textContent: e.message || "Something went wrong." }));
      renderPanel(wrap);
    }
  }

  const fab = el("button", { id: "ta-fit-fab" });
  fab.innerHTML = "\u2728 Check my fit";
  fab.addEventListener("click", onClick);
  document.body.appendChild(fab);
})();
