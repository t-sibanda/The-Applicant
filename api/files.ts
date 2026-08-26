import type { Hono } from "hono";
import { verifySession } from "./lib/auth";
import { SESSION_COOKIE } from "../shared/constants";
import { getStorage } from "./services/storage";

function sessionUserId(req: Request): Promise<number | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return Promise.resolve(null);
  const token = match.slice(SESSION_COOKIE.length + 1);
  return verifySession(token).then((claims) => claims?.userId ?? null);
}

// Keys are namespaced per user so access control is enforced by prefix:
//   users/<userId>/<filename>
function userPrefix(userId: number) {
  return `users/${userId}/`;
}

export function registerFileRoutes(app: Hono) {
  // Upload: multipart/form-data with a single "file" field.
  app.post("/api/files/upload", async (c) => {
    const userId = await sessionUserId(c.req.raw);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const key = `${userPrefix(userId)}${Date.now()}_${safeName}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await getStorage().upload(key, buf, file.type || "application/octet-stream");
    return c.json({ key });
  });

  // Download: only the owner (key must be under their prefix) may fetch.
  app.get("/api/files/*", async (c) => {
    const userId = await sessionUserId(c.req.raw);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const key = c.req.path.replace(/^\/api\/files\//, "");
    if (!key.startsWith(userPrefix(userId))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    try {
      const buf = await getStorage().download(key);
      return c.body(buf as unknown as ArrayBuffer);
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  });
}
