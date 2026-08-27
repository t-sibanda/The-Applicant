import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, authedProcedure } from "../trpc";
import { effectivePlan } from "../lib/entitlements";
import { getDb } from "../db/client";
import {
  users,
  profiles as profilesTable,
  resumeProfiles,
  applications,
  jobs as jobsTable,
  savedItems,
} from "../db/schema";
import {
  findUserByEmail,
  createUser,
  updateLastSignIn,
} from "../queries/users";
import { hashPassword, verifyPassword, signSession } from "../lib/auth";
import { checkRateLimit } from "../lib/rate-limit";
import {
  SESSION_COOKIE,
  Roles,
  UserStatus,
  SubscriptionTier,
} from "../../shared/constants";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function setSessionCookie(headers: Headers, token: string) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${
      30 * 24 * 60 * 60
    }; SameSite=Lax;${secure}`,
  );
}

function publicUser(u: {
  id: number;
  email: string;
  displayName: string | null;
  role: string;
  subscriptionTier: string;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.displayName,
    role: u.role,
    subscriptionTier: u.subscriptionTier,
  };
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        displayName: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      checkRateLimit(`register:${clientIp(ctx.req)}`, 5, 15 * 60 * 1000);

      const existing = await findUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with that email already exists.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user = await createUser({
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? input.email.split("@")[0],
        role: Roles.USER,
        status: UserStatus.ACTIVE,
        subscriptionTier: SubscriptionTier.FREE,
      });

      const token = await signSession({ userId: user.id, role: user.role });
      setSessionCookie(ctx.resHeaders, token);
      return { success: true, user: publicUser(user) };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      checkRateLimit(`login:${clientIp(ctx.req)}`, 10, 15 * 60 * 1000);

      const user = await findUserByEmail(input.email);
      // Generic message: don't reveal which field was wrong.
      const invalid = () =>
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });

      if (!user) {
        // Still run a hash to reduce timing signal.
        await verifyPassword(input.password, "x:y");
        throw invalid();
      }
      if (user.status === UserStatus.SUSPENDED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account is suspended. Contact support.",
        });
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        throw invalid();
      }

      await updateLastSignIn(user.id);
      const token = await signSession({ userId: user.id, role: user.role });
      setSessionCookie(ctx.resHeaders, token);
      return { success: true, user: publicUser(user) };
    }),

  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return publicUser(ctx.user);
  }),

  // The signed-in user's effective access (tier + active grants).
  myAccess: authedProcedure.query(async ({ ctx }) => {
    const plan = await effectivePlan(ctx.user);
    return { tier: ctx.user.subscriptionTier, plan };
  }),

  logout: authedProcedure.mutation(({ ctx }) => {
    ctx.resHeaders.append(
      "set-cookie",
      `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;`,
    );
    return { success: true };
  }),

  // ── Account settings ──
  updateAccount: authedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(120).optional(),
        email: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If changing email, ensure it isn't taken by someone else.
      if (input.email && input.email.toLowerCase() !== ctx.user.email) {
        const existing = await findUserByEmail(input.email);
        if (existing && existing.id !== ctx.user.id) {
          throw new TRPCError({ code: "CONFLICT", message: "That email is already in use." });
        }
      }
      const patch: Record<string, unknown> = {};
      if (input.displayName) patch.displayName = input.displayName;
      if (input.email) patch.email = input.email.toLowerCase();
      const rows = await getDb()
        .update(users)
        .set(patch)
        .where(eq(users.id, ctx.user.id))
        .returning();
      return publicUser(rows[0]);
    }),

  changePassword: authedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fresh = await findUserByEmail(ctx.user.email);
      if (!fresh || !(await verifyPassword(input.currentPassword, fresh.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      }
      const passwordHash = await hashPassword(input.newPassword);
      await getDb().update(users).set({ passwordHash }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // Export all of the user's data (GDPR-style portability).
  exportData: authedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const uid = ctx.user.id;
    const [profilesRows, resumes, apps, jobsRows, savedRows] = await Promise.all([
      db.select().from(profilesTable).where(eq(profilesTable.userId, uid)),
      db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, uid)),
      db.select().from(applications).where(eq(applications.userId, uid)),
      db.select().from(jobsTable).where(eq(jobsTable.userId, uid)),
      db.select().from(savedItems).where(eq(savedItems.userId, uid)),
    ]);
    return {
      account: publicUser(ctx.user),
      profiles: profilesRows,
      resumes,
      applications: apps,
      jobs: jobsRows,
      savedItems: savedRows,
      exportedAt: new Date().toISOString(),
    };
  }),

  // Permanently delete the account and all owned data (cascades via FKs).
  deleteAccount: authedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fresh = await findUserByEmail(ctx.user.email);
      if (!fresh || !(await verifyPassword(input.password, fresh.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Password is incorrect." });
      }
      await getDb().delete(users).where(eq(users.id, ctx.user.id));
      // Clear the session cookie.
      ctx.resHeaders.append(
        "set-cookie",
        `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;`,
      );
      return { success: true };
    }),
});
