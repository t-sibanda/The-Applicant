import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { applications, resumeProfiles, jobs } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { ApplicationStatus } from "../../shared/constants";
import { chatCompletion } from "../services/ai";
import { tailorResumeMessages, coverLetterMessages } from "../services/prompts";
import { requireFeature, effectivePlan } from "../lib/entitlements";
import { fetchJobText } from "../lib/fetch-job-text";
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
      await requireFeature(ctx.user, "semiApply", "Assisted apply");
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

      // If a draft already exists for this job, update it in place so the user
      // returns to the same document set rather than piling up duplicates.
      const existing = input.jobId
        ? (await db
            .select({ id: applications.id })
            .from(applications)
            .where(and(eq(applications.userId, ctx.user.id), eq(applications.jobId, input.jobId)))
            .limit(1)).at(0)
        : undefined;

      if (existing) {
        const rows = await db
          .update(applications)
          .set({
            companyName: input.companyName,
            jobTitle: input.jobTitle,
            jobUrl: input.jobUrl,
            draftResume: resumeRes.success ? resumeRes.content : null,
            draftCoverLetter: coverRes.success ? coverRes.content : null,
          })
          .where(eq(applications.id, existing.id))
          .returning();
        return rows[0];
      }

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

  // Paste-to-curate: user pastes a job LINK and/or DESCRIPTION found on another
  // site; we tailor a resume + cover letter and save a review-ready draft.
  // If only a URL is given we fetch the page text server-side (best-effort).
  prepareFromPaste: authedProcedure
    .input(
      z.object({
        url: z.string().url().max(2000).optional(),
        description: z.string().max(20000).optional(),
        companyName: z.string().max(255).optional(),
        jobTitle: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "semiApply", "Assisted apply");
      const db = getDb();
      const profile = await getActiveProfile(ctx.user.id);
      const resume = (
        await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)
      ).at(0);
      if (!resume?.baseResumeText) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add your resume first." });
      }

      // Resolve the job text: prefer the pasted description, else fetch the URL.
      let jobText = (input.description ?? "").trim();
      if (jobText.length < 40 && input.url) {
        jobText = await fetchJobText(input.url);
      }
      if (jobText.trim().length < 40) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Couldn't read enough job detail. Paste the job description text (some sites block automated reads).",
        });
      }

      const voice = resume.voiceProfile || "Professional, results-driven, uses metrics and action verbs";
      const companyName = input.companyName?.trim() || "the company";
      const jobTitle = input.jobTitle?.trim() || "this role";

      const [resumeRes, coverRes] = await Promise.all([
        chatCompletion(tailorResumeMessages({ baseResume: resume.baseResumeText, voiceProfile: voice, jobDescription: jobText }), { maxTokens: 3000 }),
        chatCompletion(coverLetterMessages({ baseResume: resume.baseResumeText, voiceProfile: voice, jobDescription: jobText, companyName, jobTitle }), { maxTokens: 2000 }),
      ]);

      const rows = await db
        .insert(applications)
        .values({
          userId: ctx.user.id,
          profileId: profile?.id,
          companyName,
          jobTitle,
          jobUrl: input.url,
          status: ApplicationStatus.DRAFT,
          draftResume: resumeRes.success ? resumeRes.content : null,
          draftCoverLetter: coverRes.success ? coverRes.content : null,
        })
        .returning();
      return { application: rows[0], usedUrl: !input.description && !!input.url };
    }),

  // Auto-apply: bulk-prepare review-ready drafts for the top-matched NEW jobs,
  // respecting the user's daily cap. Human-in-the-loop (no headless submission).
  autoApply: authedProcedure
    .input(z.object({ count: z.number().min(1).max(20).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "autoApply", "Auto-apply");
      const plan = await effectivePlan(ctx.user);
      const cap = plan.dailyAutoApplyCap;
      if (cap <= 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Auto-apply is not enabled on your plan." });
      }

      const db = getDb();
      const profile = await getActiveProfile(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Activate a profile first." });

      const resume = (await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)).at(0);
      if (!resume?.baseResumeText) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add your resume first." });

      // Count how many drafts were already prepared today (cap enforcement).
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const todays = (await db.select().from(applications).where(
        and(eq(applications.userId, ctx.user.id), eq(applications.status, ApplicationStatus.DRAFT)),
      )).filter((a) => (a.createdAt ?? new Date(0)) >= since).length;

      const remaining = Math.max(0, cap - todays);
      const want = Math.min(input?.count ?? 5, remaining);
      if (want <= 0) {
        return { prepared: 0, capReached: true, cap };
      }

      // Pick top-matched NEW jobs with a description.
      const candidates = (await db.select().from(jobs).where(
        and(eq(jobs.userId, ctx.user.id), eq(jobs.profileId, profile.id), eq(jobs.status, "new")),
      ))
        .filter((j) => !!j.description)
        .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
        .slice(0, want);

      const voice = resume.voiceProfile || "Professional, results-driven, uses metrics and action verbs";
      let prepared = 0;
      for (const j of candidates) {
        const [resumeRes, coverRes] = await Promise.all([
          chatCompletion(tailorResumeMessages({ baseResume: resume.baseResumeText, voiceProfile: voice, jobDescription: j.description! }), { maxTokens: 3000 }),
          chatCompletion(coverLetterMessages({ baseResume: resume.baseResumeText, voiceProfile: voice, jobDescription: j.description!, companyName: j.title, jobTitle: j.title }), { maxTokens: 2000 }),
        ]);
        await db.insert(applications).values({
          userId: ctx.user.id, profileId: profile.id, jobId: j.id,
          companyName: j.title, jobTitle: j.title, jobUrl: j.sourceUrl,
          status: ApplicationStatus.DRAFT,
          draftResume: resumeRes.success ? resumeRes.content : null,
          draftCoverLetter: coverRes.success ? coverRes.content : null,
        });
        await db.update(jobs).set({ status: "saved" }).where(eq(jobs.id, j.id));
        prepared++;
      }
      return { prepared, capReached: prepared >= remaining, cap };
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
