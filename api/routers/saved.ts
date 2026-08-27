import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { savedItems } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { TRPCError } from "@trpc/server";

export const savedRouter = router({
  list: authedProcedure
    .input(z.object({ type: z.enum(["job", "link", "note"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(savedItems)
        .where(eq(savedItems.userId, ctx.user.id))
        .orderBy(desc(savedItems.createdAt));
      return input?.type ? rows.filter((r) => r.type === input.type) : rows;
    }),

  add: authedProcedure
    .input(
      z.object({
        type: z.enum(["job", "link", "note"]),
        title: z.string().max(300).optional(),
        url: z.string().max(2000).optional(),
        notes: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      const rows = await getDb()
        .insert(savedItems)
        .values({
          userId: ctx.user.id,
          profileId: profile?.id,
          type: input.type,
          title: input.title,
          url: input.url,
          notes: input.notes,
        })
        .returning();
      return rows[0];
    }),

  remove: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .delete(savedItems)
        .where(and(eq(savedItems.id, input.id), eq(savedItems.userId, ctx.user.id)))
        .returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
});
