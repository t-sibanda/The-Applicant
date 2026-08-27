import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { resumeProfiles, profiles } from "../db/schema";
import { chatCompletion } from "../services/ai";
import { requireAIEntitlement } from "../lib/entitlements";

export const careerRouter = router({
  // Simulate a career path + certification roadmap from the user's profile.
  simulate: authedProcedure
    .input(
      z.object({
        targetRole: z.string().max(160).optional(),
        horizonYears: z.number().min(1).max(15).default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAIEntitlement(ctx.user);
      const db = getDb();
      const resume = (await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)).at(0);
      const profile = (await db.select().from(profiles).where(eq(profiles.userId, ctx.user.id)).limit(1)).at(0);

      const target = input.targetRole || profile?.targetRole || "the next senior role in my field";
      const industry = profile?.targetIndustry || "my industry";

      const res = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a senior career strategist. Build a realistic, actionable career plan. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Build a ${input.horizonYears}-year career plan.
TARGET: ${target}
INDUSTRY: ${industry}
CURRENT RESUME:
${(resume?.baseResumeText || "No resume provided.").slice(0, 5000)}

Return JSON:
{
  "currentAssessment": "1-2 sentence honest snapshot of where they stand",
  "competitivenessScore": 0,
  "milestones": [ { "year": 1, "role": "", "focus": "", "salaryBand": "" } ],
  "certifications": [ { "name": "", "why": "", "impact": "high|medium|low", "effort": "weeks/months" } ],
  "skillsToBuild": [ "" ],
  "quickWins": [ "3-5 things to do in the next 90 days" ]
}
Return ONLY valid JSON.`,
          },
        ],
        { maxTokens: 3000 },
      );
      if (!res.success || !res.content) return { success: false as const, error: res.error };
      try {
        const parsed = JSON.parse(res.content.replace(/```json\n?|```/g, "").trim());
        return { success: true as const, plan: parsed };
      } catch {
        return { success: false as const, error: "Could not parse AI output." };
      }
    }),
});
