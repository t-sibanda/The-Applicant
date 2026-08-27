import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { verifySession } from "./lib/auth";
import { SESSION_COOKIE, Roles, UserStatus } from "../shared/constants";
import { getDb } from "./db/client";
import { users, type User } from "./db/schema";

export interface Context {
  req: Request;
  resHeaders: Headers;
  user: User | null;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    }),
  );
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<Context> {
  const ctx: Context = {
    req: opts.req,
    resHeaders: opts.resHeaders,
    user: null,
  };

  const cookies = parseCookies(opts.req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return ctx;

  const claims = await verifySession(token);
  if (!claims) return ctx;

  try {
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, claims.userId))
      .limit(1);
    const user = rows.at(0);
    // Suspended users are treated as unauthenticated.
    if (user && user.status !== UserStatus.SUSPENDED) {
      ctx.user = user;
    }
  } catch {
    // DB unavailable — treat as unauthenticated rather than crashing.
  }

  return ctx;
}

const isProd = process.env.NODE_ENV === "production";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // In production, never leak internal error details/stacks to clients.
  // Intentional TRPCErrors (UNAUTHORIZED/FORBIDDEN/etc.) keep their messages;
  // unexpected INTERNAL_SERVER_ERRORs are shown as a generic message.
  errorFormatter({ shape, error }) {
    if (isProd && error.code === "INTERNAL_SERVER_ERROR") {
      return { ...shape, message: "Something went wrong. Please try again." };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated, non-suspended user. */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Requires an admin user. */
export const adminProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== Roles.ADMIN) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  return next({ ctx });
});
