import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { notifications } from "../db/schema";

export const notificationsRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }),

  markRead: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id),
          ),
        );
      return { success: true };
    }),

  markAllRead: authedProcedure.mutation(async ({ ctx }) => {
    await getDb()
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, ctx.user.id));
    return { success: true };
  }),
});
