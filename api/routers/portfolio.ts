import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { portfolios, resumeProfiles } from "../db/schema";
import { chatCompletion, parseJsonFromAI } from "../services/ai";
import { requireAIEntitlement } from "../lib/entitlements";

export const portfolioRouter = router({
  get: authedProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, ctx.user.id))
      .limit(1);
    return rows.at(0) ?? null;
  }),

  upsert: authedProcedure
    .input(
      z.object({
        headline: z.string().max(200).optional(),
        about: z.string().max(5000).optional(),
        accomplishments: z.array(z.string()).optional(),
        projects: z.array(z.object({ name: z.string(), desc: z.string().optional(), url: z.string().optional() })).optional(),
        publications: z.array(z.object({ title: z.string(), url: z.string().optional(), year: z.string().optional() })).optional(),
        skills: z.array(z.string()).optional(),
        links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
        template: z.enum(["modern", "minimal", "bold", "elegant"]).optional(),
        accent: z.string().max(20).optional(),
        visibility: z.record(z.string(), z.boolean()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(portfolios)
        .where(eq(portfolios.userId, ctx.user.id))
        .limit(1);
      if (existing.at(0)) {
        const rows = await db
          .update(portfolios)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(portfolios.userId, ctx.user.id))
          .returning();
        return rows[0];
      }
      const rows = await db
        .insert(portfolios)
        .values({ userId: ctx.user.id, ...input })
        .returning();
      return rows[0];
    }),

  // AI: generate a headline + about section in the user's voice from their resume.
  generateAbout: authedProcedure.mutation(async ({ ctx }) => {
    await requireAIEntitlement(ctx.user);
    const resume = await getDb()
      .select()
      .from(resumeProfiles)
      .where(eq(resumeProfiles.userId, ctx.user.id))
      .limit(1);
    const r = resume.at(0);
    if (!r?.baseResumeText) {
      return { success: false as const, error: "Add your resume first." };
    }
    const voice = r.voiceProfile || "Professional, confident, warm, and specific.";
    const res = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You write compelling personal portfolio copy in the person's own voice. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Using this résumé and voice, write portfolio copy that markets the person to interviewers.
VOICE: ${voice}
RESUME:
${r.baseResumeText.slice(0, 6000)}

Return JSON:
{ "headline": "one punchy line (max 90 chars)", "about": "2-3 short paragraphs in first person", "accomplishments": ["4-6 quantified achievement bullets"], "skills": ["8-12 key skills"] }
Return ONLY valid JSON.`,
        },
      ],
      { maxTokens: 2000, temperature: 0.4, json: true },
    );
    if (!res.success || !res.content) return { success: false as const, error: res.error };
    const parsed = parseJsonFromAI(res.content);
    return parsed
      ? { success: true as const, data: parsed }
      : { success: false as const, error: "The AI response could not be read. Please try again." };
  }),
});
