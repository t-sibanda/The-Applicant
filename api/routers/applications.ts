import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { applications, resumeProfiles, jobs } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { ApplicationStatus } from "../../shared/constants";
import { chatCompletion } from "../services/ai";
import { tailorResumeMessages, coverLetterMessages } from "../services/prompts";
import { requireAIEntitlement } from "../lib/entitlements";
import { TRPCError } from "@trpc/server";

const statusEnum = z.enum([
  ApplicationStatus.DRAFT,
  ApplicationStatus.READY,
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

  // Review-mode assisted apply: AI drafts tailored resume + cover letter for a
  // job, saved as a "draft" application the user reviews before applying.
  prepare: authedProcedure
    .input(
      z.object({
        jobId: z.number().optional(),
        companyName: z.string().max(255),
        jobTitle: z.string().max(300),
        jobUrl: z.string().max(2000).optional(),
        jobDescription: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAIEntitlement(ctx.user);
      const db = getDb();
      const profile = await getActiveProfile(ctx.user.id);
      const resume = (
        await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)
      ).at(0);
      if (!resume?.baseResumeText) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add your resume first." });
      }
      const voice = resume.voiceProfile || "Professional, results-driven, uses metrics and action verbs";

      const [resumeRes, coverRes] = await Promise.all([
        chatCompletion(tailorResumeMessages({ baseResume: resume.baseResumeText, voiceProfile: voice, jobDescription: input.jobDescription }), { maxTokens: 3000 }),
        chatCompletion(coverLetterMessages({ baseResume: resume.baseResumeText, voiceProfile: voice, jobDescription: input.jobDescription, companyName: input.companyName, jobTitle: input.jobTitle }), { maxTokens: 2000 }),
      ]);

      const rows = await db
        .insert(applications)
        .values({
          userId: ctx.user.id,
          profileId: profile?.id,
          jobId: input.jobId,
          companyName: input.companyName,
          jobTitle: input.jobTitle,
          jobUrl: input.jobUrl,
          status: ApplicationStatus.DRAFT,
          draftResume: resumeRes.success ? resumeRes.content : null,
          draftCoverLetter: coverRes.success ? coverRes.content : null,
        })
        .returning();
      return rows[0];
    }),

  updateDraft: authedProcedure
    .input(
      z.object({
        id: z.number(),
        draftResume: z.string().optional(),
        draftCoverLetter: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const rows = await getDb()
        .update(applications)
        .set(patch)
        .where(and(eq(applications.id, id), eq(applications.userId, ctx.user.id)))
        .returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return rows[0];
    }),

  get: authedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(applications)
        .where(and(eq(applications.id, input.id), eq(applications.userId, ctx.user.id)))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
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
