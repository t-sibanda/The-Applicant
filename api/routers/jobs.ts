import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { jobs, companies, scrapingLogs } from "../db/schema";
import { getActiveProfile } from "./profiles";
import { searchAllSources } from "../services/job-sources";
import { compAboveMedian, scoreCompany, rankByQuality } from "../services/quality";
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

      const outcome = await searchAllSources({
        industry: profile.targetIndustry ?? undefined,
        role: profile.targetRole ?? undefined,
        location:
          (profile.locationPrefs as { location?: string } | null)?.location ??
          undefined,
        limit: input.limit ?? 25,
      });

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
      for (const raw of outcome.jobs) {
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
        if (dupe[0]) continue;

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
            status: JobStatus.NEW,
            dedupeHash: raw.dedupeHash,
          })
          .returning({ id: jobs.id, qualityScore: jobs.qualityScore });
        saved.push(rows[0]);
      }

      return {
        found: outcome.jobs.length,
        saved: saved.length,
        logs: outcome.logs,
      };
    }),

  list: authedProcedure
    .input(z.object({ qualityFilter: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const profile = await getActiveProfile(ctx.user.id);
      if (!profile) return [];
      const rows = await getDb()
        .select()
        .from(jobs)
        .where(and(eq(jobs.userId, ctx.user.id), eq(jobs.profileId, profile.id)))
        .orderBy(desc(jobs.createdAt));
      return input?.qualityFilter ? rankByQuality(rows) : rows;
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
});
