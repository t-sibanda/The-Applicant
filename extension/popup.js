// Popup logic: connect to the user's account, fetch their autofill payload,
// and (on click) fill the active tab's form. Never submits.

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const setStatus = (msg, cls = "") => { statusEl.textContent = msg; statusEl.className = "status " + cls; };

async function getStored() {
  return new Promise((r) => chrome.storage.local.get(["apiBase", "payload"], r));
}

async function fetchPayload(apiBase) {
  // tRPC query endpoint. credentials:include sends the session cookie set when
  // the user signed in to the app in a normal tab.
  const url = `${apiBase.replace(/\/$/, "")}/api/trpc/extension.payload`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Not signed in (status ${res.status}). Open your app and sign in first.`);
  const json = await res.json();
  return json?.result?.data?.json ?? json?.result?.data;
}

async function init() {
  const { apiBase, payload } = await getStored();
  if (apiBase) $("apiBase").value = apiBase;
  if (payload) {
    $("setup").classList.add("hidden");
    $("ready").classList.remove("hidden");
    setStatus("Connected. Ready to fill.", "ok");
  }
}

$("connect").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim();
  if (!apiBase) return setStatus("Enter your app URL.", "err");
  try {
    setStatus("Connecting…");
    const payload = await fetchPayload(apiBase);
    await chrome.storage.local.set({ apiBase, payload });
    $("setup").classList.add("hidden");
    $("ready").classList.remove("hidden");
    setStatus("Connected. Ready to fill.", "ok");
  } catch (e) {
    setStatus(e.message, "err");
  }
});

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

$("fill").addEventListener("click", async () => {
  const { payload } = await getStored();
  if (!payload) return setStatus("Connect first.", "err");
  const tabId = await activeTabId();
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: fillForm,
      args: [payload.identity],
    });
    setStatus("Filled what we could. Review every field before submitting.", "ok");
  } catch (e) {
    setStatus("Could not fill this page: " + e.message, "err");
  }
});

$("copyResume").addEventListener("click", async () => {
  const { payload } = await getStored();
  await navigator.clipboard.writeText(payload?.tailoredResume || payload?.baseResumeText || "");
  setStatus("Tailored resume copied.", "ok");
});
$("copyCover").addEventListener("click", async () => {
  const { payload } = await getStored();
  await navigator.clipboard.writeText(payload?.coverLetter || "");
  setStatus("Cover letter copied.", "ok");
});

// Injected into the page. Best-effort field matching by common names/labels.
// Only fills; never clicks submit.
function fillForm(identity) {
  const map = [
    { keys: ["name", "full name", "your name", "fullname"], value: identity.name },
    { keys: ["email", "e-mail"], value: identity.email },
    { keys: ["phone", "mobile", "telephone"], value: identity.phone },
    { keys: ["linkedin"], value: identity.linkedin },
    { keys: ["portfolio", "website", "url"], value: identity.portfolio },
  ];
  const inputs = Array.from(document.querySelectorAll("input, textarea"));
  let filled = 0;
  for (const el of inputs) {
    const hay = `${el.name} ${el.id} ${el.placeholder} ${el.getAttribute("aria-label") || ""} ${el.labels?.[0]?.textContent || ""}`.toLowerCase();
    for (const m of map) {
      if (m.value && m.keys.some((k) => hay.includes(k))) {
        el.focus();
        el.value = m.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filled++;
        break;
      }
    }
  }
  return filled;
}

init();
