import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { resumeProfiles, resumeVersions } from "../db/schema";
import { chatCompletion } from "../services/ai";
import { voiceAnalysisMessages, curateResumeMessages } from "../services/prompts";
import { requireAIEntitlement } from "../lib/entitlements";
import { TRPCError } from "@trpc/server";

export const resumeRouter = router({
  listProfiles: authedProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(resumeProfiles)
      .where(eq(resumeProfiles.userId, ctx.user.id))
      .orderBy(desc(resumeProfiles.createdAt));
  }),

  createProfile: authedProcedure
    .input(
      z.object({
        profileId: z.number().optional(),
        fullName: z.string().max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        links: z.record(z.string(), z.string()).optional(),
        baseResumeText: z.string().default(""),
        baseResumeJson: z.record(z.string(), z.unknown()).optional(),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.isDefault) {
        await db
          .update(resumeProfiles)
          .set({ isDefault: false })
          .where(eq(resumeProfiles.userId, ctx.user.id));
      }
      const rows = await db
        .insert(resumeProfiles)
        .values({
          userId: ctx.user.id,
          profileId: input.profileId,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          links: input.links,
          baseResumeText: input.baseResumeText,
          baseResumeJson: input.baseResumeJson,
          isDefault: input.isDefault ?? false,
        })
        .returning();
      return rows[0];
    }),

  updateProfile: authedProcedure
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        links: z.record(z.string(), z.string()).optional(),
        baseResumeText: z.string().optional(),
        baseResumeJson: z.record(z.string(), z.unknown()).optional(),
        voiceProfile: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const rows = await getDb()
        .update(resumeProfiles)
        .set(patch)
        .where(
          and(eq(resumeProfiles.id, id), eq(resumeProfiles.userId, ctx.user.id)),
        )
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Resume profile not found." });
      return rows[0];
    }),

  createVersion: authedProcedure
    .input(
      z.object({
        resumeProfileId: z.number(),
        tailoredResumeText: z.string().optional(),
        coverLetter: z.string().optional(),
        jobRef: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of the resume profile.
      const owned = await getDb()
        .select({ id: resumeProfiles.id })
        .from(resumeProfiles)
        .where(
          and(
            eq(resumeProfiles.id, input.resumeProfileId),
            eq(resumeProfiles.userId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!owned[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Resume profile not found." });

      const rows = await getDb()
        .insert(resumeVersions)
        .values({
          resumeProfileId: input.resumeProfileId,
          tailoredResumeText: input.tailoredResumeText,
          coverLetter: input.coverLetter,
          jobRef: input.jobRef,
        })
        .returning();
      return rows[0];
    }),

  listVersions: authedProcedure
    .input(z.object({ resumeProfileId: z.number() }))
    .query(async ({ ctx, input }) => {
      const owned = await getDb()
        .select({ id: resumeProfiles.id })
        .from(resumeProfiles)
        .where(
          and(
            eq(resumeProfiles.id, input.resumeProfileId),
            eq(resumeProfiles.userId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!owned[0]) return [];
      return getDb()
        .select()
        .from(resumeVersions)
        .where(eq(resumeVersions.resumeProfileId, input.resumeProfileId))
        .orderBy(desc(resumeVersions.createdAt));
    }),

  // Curate a resume from pasted information (extra experience, another resume,
  // achievements, notes). Returns the curated text; the user reviews before
  // saving it as their base resume via updateProfile.
  curateFromPaste: authedProcedure
    .input(
      z.object({
        pastedInfo: z.string().min(20).max(20000),
        mode: z.enum(["merge", "rewrite", "targeted"]).default("merge"),
        targetContext: z.string().max(2000).optional(),
        save: z.boolean().optional(), // when true, persist to the base resume
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const db = getDb();
      const resume = (
        await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)
      ).at(0);

      const voice =
        resume?.voiceProfile ||
        "Professional, results-driven, uses metrics and action verbs";

      const res = await chatCompletion(
        curateResumeMessages({
          baseResume: resume?.baseResumeText ?? "",
          pastedInfo: input.pastedInfo,
          voiceProfile: voice,
          mode: input.mode,
          targetContext: input.targetContext,
        }),
        { maxTokens: 3200 },
      );
      if (!res.success || !res.content) return res;

      let savedProfileId: number | null = resume?.id ?? null;
      if (input.save) {
        if (resume) {
          await db
            .update(resumeProfiles)
            .set({ baseResumeText: res.content })
            .where(eq(resumeProfiles.id, resume.id));
        } else {
          const created = await db
            .insert(resumeProfiles)
            .values({ userId: ctx.user.id, baseResumeText: res.content, isDefault: true })
            .returning({ id: resumeProfiles.id });
          savedProfileId = created[0]?.id ?? null;
        }
      }

      return { success: true as const, content: res.content, saved: !!input.save, resumeProfileId: savedProfileId, error: null };
    }),

  // Voice profile: analyze samples and save to a resume profile.
  analyzeAndSaveVoice: authedProcedure
    .input(
      z.object({
        resumeProfileId: z.number(),
        samples: z.array(z.string().min(1)).min(1).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const owned = await getDb()
        .select()
        .from(resumeProfiles)
        .where(
          and(
            eq(resumeProfiles.id, input.resumeProfileId),
            eq(resumeProfiles.userId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!owned[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Resume profile not found." });

      const res = await chatCompletion(voiceAnalysisMessages(input.samples));
      if (!res.success || !res.content) return res;

      await getDb()
        .update(resumeProfiles)
        .set({ voiceProfile: res.content })
        .where(eq(resumeProfiles.id, input.resumeProfileId));

      return { success: true as const, content: res.content, error: null };
    }),
});
