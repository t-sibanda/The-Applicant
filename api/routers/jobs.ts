import { z } from "zod";
import { and, eq, desc, inArray } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { jobs, companies, scrapingLogs, resumeProfiles } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { searchAllSources } from "../services/job-sources";
import { compAboveMedian, scoreCompany, rankByQuality } from "../services/quality";
import { scoreRelevance, passesFilters } from "../services/relevance";
import { suggestCompanies } from "../services/company-suggest";
import { companyInsights } from "../services/company-insights";
import { analyzeAts } from "../services/ats";
import { chatCompletion } from "../services/ai";
import { requireAIEntitlement } from "../lib/entitlements";
import { fetchJobText } from "../lib/fetch-job-text";
import { JobStatus } from "../../shared/constants";
import { TRPCError } from "@trpc/server";

export const jobsRouter = router({
  search: authedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        qualityFilter: z.boolean().optional(),
        // Filters
        location: z.string().max(120).optional(),
        company: z.string().max(200).optional(),
        keywords: z.string().max(300).optional(),
        source: z.string().max(80).optional(),
        minRelevance: z.number().min(0).max(100).optional(),
        maxDaysOld: z.number().min(1).max(90).optional(),
        sortByDate: z.boolean().optional(),
        minSalary: z.number().min(0).max(1000000).optional(),
        contractType: z.enum(["full_time", "part_time", "contract", "permanent"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      if (!profile) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Create and activate a profile before searching jobs.",
        });
      }

      const keywordList = (input.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const outcome = await searchAllSources({
        industry: profile.targetIndustry ?? undefined,
        role: input.keywords || profile.targetRole || undefined,
        company: input.company || undefined,
        location:
          input.location ??
          (profile.locationPrefs as { location?: string } | null)?.location ??
          undefined,
        limit: input.limit ?? 50,
        maxDaysOld: input.maxDaysOld,
        sortByDate: input.sortByDate,
        minSalary: input.minSalary,
        contractType: input.contractType,
      });

      const relInputs = {
        targetRole: profile.targetRole,
        targetIndustry: profile.targetIndustry,
        keywords: keywordList,
        company: input.company,
        location: input.location,
      };
      // When the user explicitly filters by company (or by their own keywords),
      // they've already narrowed intent, so don't also gate on profile-role
      // relevance. A hard company filter already scoped the results.
      const explicitScope = !!input.company || keywordList.length > 0;
      const minRel = explicitScope ? 0 : (input.minRelevance ?? 45);

      const db = getDb();

      // Log each source outcome for transparency (single batched insert).
      if (outcome.logs.length) {
        await db.insert(scrapingLogs).values(
          outcome.logs.map((log) => ({
            userId: ctx.user.id,
            profileId: profile.id,
            sourceName: log.source,
            count: log.count,
            status: log.status,
            error: log.error,
          })),
        );
      }

      // ── Filter first (pure, no DB), then persist in batches ──
      let discarded = 0;
      let duplicates = 0;

      // Pass 1: apply all filters and de-dupe within this result set.
      const seenHashes = new Set<string>();
      const kept: Array<{ raw: (typeof outcome.jobs)[number]; relevance: number }> = [];
      for (const raw of outcome.jobs) {
        if (input.source && raw.sourceName !== input.source) continue;
        if (!passesFilters(raw, relInputs)) { discarded++; continue; }
        const relevance = scoreRelevance(raw, relInputs);
        if (relevance < minRel) { discarded++; continue; }
        if (input.minSalary && input.minSalary > 0) {
          const known = raw.compensation?.max ?? raw.compensation?.min;
          if (known != null && known < input.minSalary) { discarded++; continue; }
        }
        if (seenHashes.has(raw.dedupeHash)) { duplicates++; continue; }
        seenHashes.add(raw.dedupeHash);
        kept.push({ raw, relevance });
      }

      // One query for existing dedupe hashes on this profile (vs one per job).
      const existing = kept.length
        ? await db
            .select({ h: jobs.dedupeHash })
            .from(jobs)
            .where(eq(jobs.profileId, profile.id))
        : [];
      const existingHashes = new Set(existing.map((r) => r.h));
      const fresh = kept.filter((k) => {
        if (existingHashes.has(k.raw.dedupeHash)) { duplicates++; return false; }
        return true;
      });

      // Resolve companies in one pass (dedupe by name, batch-insert new ones).
      const companyByName = new Map<string, number>();
      if (fresh.length) {
        const names = [...new Set(fresh.map((f) => f.raw.companyName))];
        const found = await db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(inArray(companies.name, names));
        for (const c of found) companyByName.set(c.name, c.id);
        const missing = names.filter((n) => !companyByName.has(n));
        if (missing.length) {
          const created = await db
            .insert(companies)
            .values(missing.map((name) => ({ name, industry: profile.targetIndustry ?? undefined, unrated: true })))
            .returning({ id: companies.id, name: companies.name });
          for (const c of created) companyByName.set(c.name, c.id);
        }
      }

      // Batch-insert all fresh jobs in a single statement.
      let saved: Array<{ id: number }> = [];
      if (fresh.length) {
        saved = await db
          .insert(jobs)
          .values(
            fresh.map(({ raw, relevance }) => {
              const above = compAboveMedian(raw, null);
              const quality = scoreCompany({}, above);
              return {
                userId: ctx.user.id,
                profileId: profile.id,
                companyId: companyByName.get(raw.companyName),
                title: raw.title,
                description: raw.description,
                sourceName: raw.sourceName,
                sourceUrl: raw.sourceUrl,
                compensation: raw.compensation ?? undefined,
                qualityScore: quality.qualityScore ?? undefined,
                relevanceScore: relevance,
                postedDate: raw.postedDate ?? undefined,
                status: JobStatus.NEW,
                dedupeHash: raw.dedupeHash,
              };
            }),
          )
          .returning({ id: jobs.id });
      }

      return {
        found: outcome.jobs.length,
        saved: saved.length,
        discarded,
        duplicates,
        logs: outcome.logs,
      };
    }),

  // Company suggestions ranked against the active profile + optional keywords,
  // optionally narrowed to a chosen industry.
  suggestCompanies: authedProcedure
    .input(
      z
        .object({
          keywords: z.string().max(300).optional(),
          industryId: z.string().max(40).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      const keywordList = (input?.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      return suggestCompanies({
        industry: profile?.targetIndustry,
        role: profile?.targetRole,
        keywords: keywordList,
        industryId: input?.industryId,
        limit: 15,
      });
    }),

  // Company hiring insights: read a company's public ATS board and analyze
  // departments hiring, high-volume roles, and rare/niche openings.
  companyInsights: authedProcedure
    .input(z.object({ company: z.string().min(1).max(120) }))
    .query(async ({ input }) => {
      return companyInsights(input.company);
    }),

  // Quick scan: fast, no-AI read of a job against the user's profile + resume.
  // Returns a match rating and a plain suggestion (apply / worth a look / skip),
  // plus the keyword gaps so the user knows what the Optimizer would fix.
  quickScan: authedProcedure
    .input(
      z.object({
        description: z.string().max(20000).optional(),
        url: z.string().url().max(2000).optional(),
        title: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      const resume = (
        await getDb().select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)
      ).at(0);

      let jobText = (input.description ?? "").trim();
      if (jobText.length < 40 && input.url) {
        jobText = await fetchJobText(input.url);
      }
      if (jobText.trim().length < 40) {
        return {
          ok: false as const,
          reason:
            "Couldn't read enough job detail. Paste the job description text (some sites block automated reads).",
        };
      }

      // Relevance to the user's targeting (0-100).
      const relevance = scoreRelevance(
        {
          title: input.title ?? "",
          description: jobText,
          companyName: "",
          sourceName: "scan",
          sourceUrl: input.url ?? "",
          dedupeHash: "scan",
        },
        {
          targetRole: profile?.targetRole,
          targetIndustry: profile?.targetIndustry,
          keywords: [],
        },
      );

      // ATS fit vs the current base resume (deterministic, instant).
      const resumeText = resume?.baseResumeText ?? "";
      const ats = resumeText ? analyzeAts(resumeText, jobText, input.title) : null;

      // Blend into a single match rating. Relevance always counts; ATS only
      // when we have a resume to compare against.
      const match = ats
        ? Math.round(relevance * 0.5 + ats.baseScore * 0.5)
        : relevance;

      const suggestion: "strong" | "worth_a_look" | "weak" =
        match >= 70 ? "strong" : match >= 45 ? "worth_a_look" : "weak";
      const suggestionText =
        suggestion === "strong"
          ? "Strong match. Worth applying."
          : suggestion === "worth_a_look"
            ? "Decent match. Tailoring your resume would help."
            : "Weak match as-is. Consider whether it fits, or tailor heavily.";

      return {
        ok: true as const,
        match,
        relevance,
        atsBase: ats?.baseScore ?? null,
        hasResume: !!resumeText,
        matchedKeywords: ats?.keyword.matched.slice(0, 12) ?? [],
        missingKeywords: ats?.keyword.missing.slice(0, 12) ?? [],
        formatIssues: ats?.format.issues ?? [],
        suggestion,
        suggestionText,
        jobText: jobText.slice(0, 16000), // returned so the client can reuse it for curation without re-fetching
      };
    }),

  // Match chat: answer the user's questions about how well they fit a specific
  // job, using their resume and profile targeting plus the pasted job text as
  // the only context. No invented metrics.
  matchChat: authedProcedure
    .input(
      z.object({
        jobText: z.string().min(1).max(16000),
        jobTitle: z.string().max(300).optional(),
        question: z.string().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(20)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const profile = await getActiveProfile(ctx.user.id);
      const resume = (
        await getDb()
          .select()
          .from(resumeProfiles)
          .where(eq(resumeProfiles.userId, ctx.user.id))
          .limit(1)
      ).at(0);

      const resumeText = resume?.baseResumeText?.trim() || "(no resume on file yet)";
      const targeting = [
        profile?.targetRole ? `Target role: ${profile.targetRole}` : null,
        profile?.targetIndustry ? `Target industry: ${profile.targetIndustry}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const system = [
        "You are a candid job-fit assistant inside The Applicant.",
        "Answer only about how well this candidate fits THIS job.",
        "Base every answer on the candidate's resume and the job text below.",
        "Be honest about gaps. Do not invent numbers, metrics, or facts.",
        "Keep answers short, plain, and warm. No em dashes.",
        "",
        input.jobTitle ? `Job title: ${input.jobTitle}` : "",
        targeting ? `Candidate targeting:\n${targeting}` : "",
        "",
        "Candidate resume:",
        resumeText,
        "",
        "Job description:",
        input.jobText,
      ]
        .filter((l) => l !== "")
        .join("\n");

      const messages = [
        { role: "system" as const, content: system },
        ...((input.history ?? []).map((m) => ({ role: m.role, content: m.content }))),
        { role: "user" as const, content: input.question },
      ];

      return chatCompletion(messages, { maxTokens: 700 });
    }),

  list: authedProcedure
    .input(
      z.object({
        qualityFilter: z.boolean().optional(),
        sort: z.enum(["recent", "relevance", "quality"]).optional(),
        withCompensationOnly: z.boolean().optional(),
        status: z.enum([JobStatus.NEW, JobStatus.SAVED, JobStatus.APPLIED]).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      if (!profile) return [];
      let rows = await getDb()
        .select()
        .from(jobs)
        .where(and(eq(jobs.userId, ctx.user.id), eq(jobs.profileId, profile.id)))
        .orderBy(desc(jobs.createdAt));

      if (input?.withCompensationOnly) {
        rows = rows.filter((r) => !!r.compensation);
      }
      if (input?.status) {
        rows = rows.filter((r) => r.status === input.status);
      }

      const sort = input?.sort ?? (input?.qualityFilter ? "quality" : "recent");
      if (sort === "quality") return rankByQuality(rows);
      if (sort === "relevance")
        return [...rows].sort((a, b) => (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1));
      return rows; // recent (already ordered by createdAt desc)
    }),

  // Delete all jobs for the active profile (a true "clear & refresh").
  clear: authedProcedure.mutation(async ({ ctx }) => {
    const profile = await getActiveProfile(ctx.user.id);
    if (!profile) return { cleared: 0 };
    const rows = await getDb()
      .delete(jobs)
      .where(and(eq(jobs.userId, ctx.user.id), eq(jobs.profileId, profile.id)))
      .returning({ id: jobs.id });
    return { cleared: rows.length };
  }),

  setStatus: authedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([JobStatus.NEW, JobStatus.SAVED, JobStatus.APPLIED]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .update(jobs)
        .set({ status: input.status })
        .where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)))
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      return rows[0];
    }),

  // Personal quality rating (0-100) set by the user for a job's company.
  rate: authedProcedure
    .input(z.object({ id: z.number(), score: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .update(jobs)
        .set({ qualityScore: input.score })
        .where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)))
        .returning();
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      return rows[0];
    }),

  // Delete a single job (e.g. "not interested").
  remove: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .delete(jobs)
        .where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)))
        .returning({ id: jobs.id });
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      return { success: true };
    }),
});
