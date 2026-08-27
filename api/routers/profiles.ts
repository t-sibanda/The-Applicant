import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { profiles } from "../db/schema";
import { effectivePlan } from "../lib/entitlements";
import { TRPCError } from "@trpc/server";

export const profilesRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(profiles)
      .where(eq(profiles.userId, ctx.user.id));
  }),

  create: authedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        targetIndustry: z.string().max(120).optional(),
        targetRole: z.string().max(120).optional(),
        locationPrefs: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, ctx.user.id));

      const plan = await effectivePlan(ctx.user);
      const max = plan.maxProfiles;
      if (existing.length >= max) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Your plan allows up to ${max} profile(s). Upgrade to add more.`,
        });
      }

      const rows = await db
        .insert(profiles)
        .values({
          userId: ctx.user.id,
          name: input.name,
          targetIndustry: input.targetIndustry,
          targetRole: input.targetRole,
          locationPrefs: input.locationPrefs,
          // First profile becomes active by default.
          isActive: existing.length === 0,
        })
        .returning();
      return rows[0];
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(120).optional(),
        targetIndustry: z.string().max(120).optional(),
        targetRole: z.string().max(120).optional(),
        locationPrefs: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const rows = await getDb()
        .update(profiles)
        .set(patch)
        .where(and(eq(profiles.id, id), eq(profiles.userId, ctx.user.id)))
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
      return rows[0];
    }),

  setActive: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Ensure the profile belongs to the user.
      const owned = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, input.id), eq(profiles.userId, ctx.user.id)))
        .limit(1);
      if (!owned[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });

      await db
        .update(profiles)
        .set({ isActive: false })
        .where(eq(profiles.userId, ctx.user.id));
      await db
        .update(profiles)
        .set({ isActive: true })
        .where(and(eq(profiles.id, input.id), eq(profiles.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .delete(profiles)
        .where(and(eq(profiles.id, input.id), eq(profiles.userId, ctx.user.id)))
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
      return { success: true };
    }),
});

/** Helper used by other routers to resolve the user's active profile. */
export async function getActiveProfile(userId: number) {
  const rows = await getDb()
    .select()
    .from(profiles)
    .where(and(eq(profiles.userId, userId), eq(profiles.isActive, true)))
    .limit(1);
  return rows.at(0) ?? null;
}
