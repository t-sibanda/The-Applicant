import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { jobs, companies, scrapingLogs } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { searchAllSources } from "../services/job-sources";
import { compAboveMedian, scoreCompany, rankByQuality } from "../services/quality";
import { scoreRelevance, passesFilters } from "../services/relevance";
import { JobStatus } from "../../shared/constants";
import { TRPCError } from "@trpc/server";

async function upsertCompany(name: string, industry?: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(companies)
    .where(eq(companies.name, name))
    .limit(1);
  if (existing[0]) return existing[0];
  const rows = await db
    .insert(companies)
    .values({ name, industry, unrated: true })
    .returning();
  return rows[0];
}

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
        location:
          input.location ??
          (profile.locationPrefs as { location?: string } | null)?.location ??
          undefined,
        limit: input.limit ?? 40,
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
      const minRel = input.minRelevance ?? 45;

      const db = getDb();

      // Log each source outcome for transparency.
      for (const log of outcome.logs) {
        await db.insert(scrapingLogs).values({
          userId: ctx.user.id,
          profileId: profile.id,
          sourceName: log.source,
          count: log.count,
          status: log.status,
          error: log.error,
        });
      }

      // Persist new jobs (dedup against existing rows for this profile).
      const saved: Array<{ id: number; qualityScore: number | null }> = [];
      let discarded = 0;
      let duplicates = 0;
      for (const raw of outcome.jobs) {
        // Source filter.
        if (input.source && raw.sourceName !== input.source) continue;
        // Hard filters (company/location).
        if (!passesFilters(raw, relInputs)) {
          discarded++;
          continue;
        }
        // Relevance: skip low-relevance jobs so irrelevant ones aren't saved.
        const relevance = scoreRelevance(raw, relInputs);
        if (relevance < minRel) {
          discarded++;
          continue;
        }
        // Salary floor (soft): only drop jobs whose KNOWN salary is below the
        // floor. Jobs without salary data are kept (they may still qualify) and
        // flagged in the UI as unverified.
        if (input.minSalary && input.minSalary > 0) {
          const known = raw.compensation?.max ?? raw.compensation?.min;
          if (known != null && known < input.minSalary) {
            discarded++;
            continue;
          }
        }

        const dupe = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(
            and(
              eq(jobs.profileId, profile.id),
              eq(jobs.dedupeHash, raw.dedupeHash),
            ),
          )
          .limit(1);
        if (dupe[0]) { duplicates++; continue; }

        const company = await upsertCompany(
          raw.companyName,
          profile.targetIndustry ?? undefined,
        );

        // Quality: we only have comp data here; culture/retention come from
        // enrichment sources when configured. Unrated otherwise (honesty rule).
        const above = compAboveMedian(raw, null);
        const quality = scoreCompany(
          {
            cultureScore: company.cultureScore ?? undefined,
            retentionScore: company.retentionScore ?? undefined,
          },
          above,
        );

        const rows = await db
          .insert(jobs)
          .values({
            userId: ctx.user.id,
            profileId: profile.id,
            companyId: company.id,
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
          })
          .returning({ id: jobs.id, qualityScore: jobs.qualityScore });
        saved.push(rows[0]);
      }

      return {
        found: outcome.jobs.length,
        saved: saved.length,
        discarded,
        duplicates,
        logs: outcome.logs,
      };
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
