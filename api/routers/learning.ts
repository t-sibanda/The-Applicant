import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { learningItems } from "../db/schema";
import { chatCompletion, parseJsonFromAI } from "../services/ai";
import { requireAIEntitlement } from "../lib/entitlements";
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

      // Best-effort AI enrichment (only if the plan includes AI).
      const canAI =
        ctx.user.subscriptionTier === "basic" ||
        ctx.user.subscriptionTier === "pro";
      if (canAI) {
        const res = await chatCompletion(
          [
            {
              role: "system",
              content:
                "You turn career/industry content references into concise, actionable learning notes for a job seeker. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: `A user saved this ${input.category} resource:
URL: ${input.url}
Title/context: ${input.title ?? "(none)"}
Their note: ${input.note ?? "(none)"}

Based on the title/context (and typical content of such posts), produce:
{ "summary": "1-2 sentence summary", "takeaways": ["3-5 concrete tips the user can apply to their resume/profile/career"] }
Return ONLY valid JSON.`,
            },
          ],
          { maxTokens: 800 },
        );
        if (res.success && res.content) {
          const parsed = parseJsonFromAI<{ summary: string; takeaways: string[] }>(res.content);
          summary = parsed?.summary ?? null;
          takeaways = parsed?.takeaways ?? [];
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

  // Aggregate takeaways into a set of profile-enhancement tips.
  digest: authedProcedure.mutation(async ({ ctx }) => {
    requireAIEntitlement(ctx.user);
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
      { maxTokens: 1200 },
    );
    if (!res.success || !res.content) return { success: false as const, error: res.error };
    const parsed = parseJsonFromAI(res.content);
    return parsed
      ? { success: true as const, digest: parsed }
      : { success: false as const, error: "Could not parse." };
  }),
});
