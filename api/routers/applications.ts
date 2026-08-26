import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { applications } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { ApplicationStatus } from "../../shared/constants";
import { TRPCError } from "@trpc/server";

const statusEnum = z.enum([
  ApplicationStatus.SAVED,
  ApplicationStatus.APPLIED,
  ApplicationStatus.PHONE_SCREEN,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
]);

export const applicationsRouter = router({
  create: authedProcedure
    .input(
      z.object({
        jobId: z.number().optional(),
        companyName: z.string().max(255).optional(),
        status: statusEnum.default(ApplicationStatus.APPLIED),
        linkedVersionId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      const rows = await getDb()
        .insert(applications)
        .values({
          userId: ctx.user.id,
          profileId: profile?.id,
          jobId: input.jobId,
          companyName: input.companyName,
          status: input.status,
          linkedVersionId: input.linkedVersionId,
        })
        .returning();
      return rows[0];
    }),

  updateStatus: authedProcedure
    .input(z.object({ id: z.number(), status: statusEnum }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .update(applications)
        .set({ status: input.status })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found." });
      return rows[0];
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(applications)
      .where(eq(applications.userId, ctx.user.id))
      .orderBy(desc(applications.createdAt));
  }),
});
