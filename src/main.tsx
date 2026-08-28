import React from "react";
import ReactDOM from "react-dom/client";
import { TRPCProvider } from "@/providers/TRPCProvider";
import App from "@/App";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </React.StrictMode>,
);

// Register the service worker so the app is installable (PWA) and loads fast
// on repeat visits. Only in production builds and where supported.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* non-fatal: app still works without the service worker */
    });
  });
}
