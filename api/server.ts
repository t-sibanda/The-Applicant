import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./trpc";
import { env, integrationStatus } from "./lib/env";
import { registerFileRoutes } from "./files";

const app = new Hono();

// File upload/download routes (per-user access control).
registerFileRoutes(app);

// ─── Health check ────────────────────────────────────────────────
// Reports DB connectivity + which optional integrations are enabled,
// without leaking secret values.
app.get("/api/health", async (c) => {
  const info: Record<string, unknown> = {
    server: "ok",
    timestamp: new Date().toISOString(),
    integrations: integrationStatus(),
  };

  try {
    const { getSql } = await import("./db/client");
    const sql = getSql();
    const result = await sql`select 1 as ok`;
    info.database = result?.[0]?.ok === 1 ? "connected" : "unknown";
  } catch (err) {
    info.database = "FAILED";
    // Never leak raw DB errors publicly — they can contain host/connection
    // details. Only surface detail in non-production for local debugging.
    if (!env.isProduction) {
      info.databaseError = err instanceof Error ? err.message : String(err);
    }
  }

  return c.json(info);
});

// ─── Stripe webhook (raw body, signature-verified) ──────────────
// Must be registered before tRPC and read the raw body for signature checks.
app.post("/api/stripe/webhook", async (c) => {
  const { handleWebhook } = await import("./services/payments");
  const signature = c.req.header("stripe-signature") ?? "";
  const rawBody = await c.req.text();
  const handled = await handleWebhook(rawBody, signature);
  return handled ? c.json({ received: true }) : c.json({ error: "ignored" }, 400);
});

// ─── CORS for the API (enables the browser extension to call with creds) ──
// Reflects the request origin and allows credentials. The SPA is same-origin
// (no CORS needed); this exists so the autofill extension — running on
// third-party application pages — can fetch the user's payload securely.
app.use("/api/trpc/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (origin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Headers", "content-type, authorization");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Vary", "Origin");
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

// ─── tRPC ────────────────────────────────────────────────────────
app.use("/api/trpc/*", (c) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  }),
);

// Any other /api/* path is a real 404.
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

// ─── Production: serve the built SPA from the same origin ────────
if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStatic } = await import("@hono/node-server/serve-static");

  // Serve static assets from dist/public, with SPA fallback to index.html.
  app.use("/*", serveStatic({ root: "./dist/public" }));
  app.get("/*", serveStatic({ path: "./dist/public/index.html" }));

  serve({ fetch: app.fetch, port: env.port }, () => {
    // eslint-disable-next-line no-console
    console.log(`The Applicant running on http://localhost:${env.port}/`);
  });
}
