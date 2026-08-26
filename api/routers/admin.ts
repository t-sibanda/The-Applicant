import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { router, adminProcedure, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { users, supportRequests } from "../db/schema";
import { UserStatus } from "../../shared/constants";
import { TRPCError } from "@trpc/server";

export const adminRouter = router({
  // ── Admin-only: user management ──
  listUsers: adminProcedure.query(async () => {
    return getDb()
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        subscriptionTier: users.subscriptionTier,
        createdAt: users.createdAt,
        lastSignInAt: users.lastSignInAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
  }),

  setUserStatus: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own status.",
        });
      }
      const rows = await getDb()
        .update(users)
        .set({ status: input.status })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id, status: users.status });
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      return rows[0];
    }),

  setUserTier: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        tier: z.enum(["free", "basic", "pro"]),
      }),
    )
    .mutation(async ({ input }) => {
      const rows = await getDb()
        .update(users)
        .set({ subscriptionTier: input.tier })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id, subscriptionTier: users.subscriptionTier });
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      return rows[0];
    }),

  // ── Admin-only: support requests ──
  listSupportRequests: adminProcedure.query(async () => {
    return getDb()
      .select()
      .from(supportRequests)
      .orderBy(desc(supportRequests.createdAt));
  }),

  resolveSupportRequest: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const rows = await getDb()
        .update(supportRequests)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(supportRequests.id, input.id))
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      return rows[0];
    }),

  // ── User-facing: submit a support/help request ──
  createSupportRequest: authedProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(255),
        message: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .insert(supportRequests)
        .values({
          userId: ctx.user.id,
          subject: input.subject,
          message: input.message,
          status: "open",
        })
        .returning();
      return rows[0];
    }),
});
