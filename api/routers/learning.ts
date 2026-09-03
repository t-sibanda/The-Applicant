import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { learningItems, resumeProfiles } from "../db/schema";
import { chatCompletion, parseJsonFromAI } from "../services/ai";
import { hasFeature, requireAIEntitlement } from "../lib/entitlements";
import { fetchJobText } from "../lib/fetch-job-text";
import { TRPCError } from "@trpc/server";

export const learningRouter = router({
  list: authedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(learningItems)
        .where(eq(learningItems.userId, ctx.user.id))
        .orderBy(desc(learningItems.createdAt));
      return input?.category && input.category !== "all"
        ? rows.filter((r) => r.category === input.category)
        : rows;
    }),

  // Add a link and let AI summarize it into actionable takeaways.
  add: authedProcedure
    .input(
      z.object({
        url: z.string().url(),
        title: z.string().max(300).optional(),
        note: z.string().max(2000).optional(),
        category: z.enum(["tip", "resume", "career", "industry"]).default("tip"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let summary: string | null = null;
      let takeaways: string[] = [];
      let skillTags: string[] = [];

      // Best-effort AI enrichment. Grant-aware: honors tier AND admin grants.
      const canAI = await hasFeature(ctx.user, "aiOptimizer");
      if (canAI) {
        // Fetch the actual page so the summary and takeaways come from the
        // real content. If the page is unreadable (JS-only, blocked), fall
        // back to the title and say so rather than guessing.
        const pageText = await fetchJobText(input.url);
        const source = pageText
          ? `PAGE CONTENT (excerpt):\n${pageText.slice(0, 6000)}`
          : "(The page content could not be fetched; base this only on the URL, title, and note, and keep takeaways general.)";

        const res = await chatCompletion(
          [
            {
              role: "system",
              content:
                "You turn career/industry content into concise, actionable learning notes for a job seeker. Only state what the provided content supports; never invent claims. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: `A user saved this ${input.category} resource:
URL: ${input.url}
Title/context: ${input.title ?? "(none)"}
Their note: ${input.note ?? "(none)"}
${source}

Produce:
{ "summary": "1-2 sentence summary", "takeaways": ["3-5 concrete tips the user can apply to their resume/profile/career"], "skillTags": ["0-4 specific skills this resource teaches, e.g. \\"Kubernetes\\", \\"System design\\" — empty if none"] }
Return ONLY valid JSON.`,
            },
          ],
          { maxTokens: 800, temperature: 0.2, json: true },
        );
        if (res.success && res.content) {
          const parsed = parseJsonFromAI<{ summary: string; takeaways: string[]; skillTags?: string[] }>(res.content);
          summary = parsed?.summary ?? null;
          takeaways = parsed?.takeaways ?? [];
          skillTags = (parsed?.skillTags ?? []).filter(Boolean).slice(0, 4);
        }
      }

      const rows = await getDb()
        .insert(learningItems)
        .values({
          userId: ctx.user.id,
          url: input.url,
          title: input.title ?? input.url,
          category: input.category,
          summary,
          takeaways,
          skillTags,
        })
        .returning();
      return rows[0];
    }),

  remove: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .delete(learningItems)
        .where(and(eq(learningItems.id, input.id), eq(learningItems.userId, ctx.user.id)))
        .returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  // Mark a resource as learned (or move it back). On "done" its skill tags
  // merge into the profile's skills, so learning visibly upgrades the profile
  // and feeds future job-match scoring.
  setStatus: authedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "done"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .update(learningItems)
        .set({ status: input.status })
        .where(and(eq(learningItems.id, input.id), eq(learningItems.userId, ctx.user.id)))
        .returning();
      const item = rows[0];
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.status === "done") {
        const tags = ((item.skillTags as string[]) ?? []).filter(Boolean);
        if (tags.length) {
          const rp = (
            await db
              .select()
              .from(resumeProfiles)
              .where(eq(resumeProfiles.userId, ctx.user.id))
              .limit(1)
          ).at(0);
          if (rp) {
            const have = new Set((((rp.skills as string[]) ?? [])).map((s) => s.toLowerCase()));
            const merged = [...((rp.skills as string[]) ?? [])];
            for (const t of tags) if (!have.has(t.toLowerCase())) merged.push(t);
            await db.update(resumeProfiles).set({ skills: merged }).where(eq(resumeProfiles.id, rp.id));
          }
        }
      }
      return { success: true, item };
    }),

  // Aggregate takeaways into a set of profile-enhancement tips.
  digest: authedProcedure.mutation(async ({ ctx }) => {
    await requireAIEntitlement(ctx.user);
    const items = await getDb()
      .select()
      .from(learningItems)
      .where(eq(learningItems.userId, ctx.user.id))
      .orderBy(desc(learningItems.createdAt));
    if (items.length === 0) return { success: false as const, error: "Add some resources first." };

    const allTakeaways = items.flatMap((i) => (i.takeaways as string[]) ?? []);
    const res = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You synthesize a job seeker's saved learning into a prioritized action plan. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `From these saved takeaways, produce a prioritized plan to strengthen the user's profile and candidacy:
${allTakeaways.slice(0, 40).map((t) => `- ${t}`).join("\n")}

Return JSON: { "themes": ["3-5 recurring themes"], "actions": ["5-8 prioritized actions"] }
Return ONLY valid JSON.`,
        },
      ],
      { maxTokens: 1200, temperature: 0.2, json: true },
    );
    if (!res.success || !res.content) return { success: false as const, error: res.error };
    const parsed = parseJsonFromAI(res.content);
    return parsed
      ? { success: true as const, digest: parsed }
      : { success: false as const, error: "Could not parse." };
  }),
});
