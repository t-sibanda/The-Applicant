// Popup: store the app base URL the content script calls.
const baseInput = document.getElementById("base");
const status = document.getElementById("status");

chrome.storage.sync.get(["baseUrl"], (r) => {
  if (r.baseUrl) baseInput.value = r.baseUrl;
});

document.getElementById("save").addEventListener("click", () => {
  let v = (baseInput.value || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(v)) {
    status.textContent = "Enter a full https:// URL.";
    status.className = "status err";
    return;
  }
  chrome.storage.sync.set({ baseUrl: v }, () => {
    status.textContent = "Saved. Open a job posting and click Check my fit.";
    status.className = "status ok";
  });
});
