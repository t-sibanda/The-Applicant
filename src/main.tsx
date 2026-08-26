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
