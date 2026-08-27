import { z } from "zod";
import { router, authedProcedure } from "../trpc";
import { chatCompletion, parseJsonFromAI } from "../services/ai";
import { analyzeAts } from "../services/ats";
import { requireAIEntitlement } from "../lib/entitlements";
import {
  parseJobMessages,
  tailorResumeMessages,
  coverLetterMessages,
  atsScoreMessages,
  voiceAnalysisMessages,
  interviewQuestionMessages,
  followUpMessages,
  networkingMessages,
  interviewEvalMessages,
  skillGapMessages,
  type CompanyStyle,
} from "../services/prompts";

const styleEnum = z
  .enum([
    "formal_corporate",
    "startup_energy",
    "faang_precision",
    "mission_driven",
    "casual_collaborative",
  ])
  .optional();

const chatMessagesInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

export const aiRouter = router({
  parseJob: authedProcedure
    .input(z.object({ description: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const res = await chatCompletion(parseJobMessages(input.description));
      if (!res.success || !res.content)
        return { success: false as const, parsed: null, error: res.error };
      const parsed = parseJsonFromAI(res.content);
      return parsed
        ? { success: true as const, parsed, error: null }
        : {
            success: false as const,
            parsed: null,
            error: "Failed to parse AI response.",
          };
    }),

  tailorResume: authedProcedure
    .input(
      z.object({
        baseResume: z.string().min(1),
        voiceProfile: z.string().min(1),
        jobDescription: z.string().min(1),
        contact: z.string().optional(),
        companyStyle: styleEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(
        tailorResumeMessages({
          baseResume: input.baseResume,
          voiceProfile: input.voiceProfile,
          jobDescription: input.jobDescription,
          contact: input.contact,
          style: input.companyStyle as CompanyStyle | undefined,
        }),
      );
    }),

  generateCoverLetter: authedProcedure
    .input(
      z.object({
        baseResume: z.string().min(1),
        voiceProfile: z.string().min(1),
        jobDescription: z.string().min(1),
        companyName: z.string().min(1),
        jobTitle: z.string().min(1),
        companyStyle: styleEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(
        coverLetterMessages({
          baseResume: input.baseResume,
          voiceProfile: input.voiceProfile,
          jobDescription: input.jobDescription,
          companyName: input.companyName,
          jobTitle: input.jobTitle,
          style: input.companyStyle as CompanyStyle | undefined,
        }),
      );
    }),

  atsScore: authedProcedure
    .input(
      z.object({
        resumeText: z.string().min(1),
        jobDescription: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);

      // 1) Deterministic analysis (keyword coverage, format, seniority, hard reqs).
      const det = analyzeAts(input.resumeText, input.jobDescription);

      // 2) AI semantic pass: judge how well the experience actually matches
      // beyond literal keywords (0-100), plus prioritized fixes.
      const semanticMsgs = [
        {
          role: "system" as const,
          content:
            "You are an ATS and recruiting expert. Judge semantic fit between a resume and job beyond literal keywords. Return ONLY valid JSON.",
        },
        {
          role: "user" as const,
          content: `Assess semantic match. Consider transferable skills, impact, and domain fit.
RESUME:
${input.resumeText.slice(0, 6000)}

JOB:
${input.jobDescription.slice(0, 4000)}

Return JSON:
{ "semanticScore": 0, "strengths": [], "prioritizedFixes": [] }
Return ONLY valid JSON.`,
        },
      ];
      const aiRes = await chatCompletion(semanticMsgs, { maxTokens: 1500 });
      const semantic = aiRes.success && aiRes.content
        ? parseJsonFromAI<{ semanticScore: number; strengths: string[]; prioritizedFixes: string[] }>(aiRes.content)
        : null;

      const semanticScore = Math.max(0, Math.min(100, semantic?.semanticScore ?? 60));

      // 3) Combine: deterministic base (80%) + semantic (20%).
      const overallScore = Math.round(det.baseScore * 0.8 + semanticScore * 0.2);

      // Hard-requirement gap flags.
      const reqGaps: string[] = [];
      const resumeLower = input.resumeText.toLowerCase();
      if (det.hardRequirements.yearsRequired) {
        reqGaps.push(`Role asks for ~${det.hardRequirements.yearsRequired}+ years — ensure your experience makes this obvious.`);
      }
      if (det.hardRequirements.degreeRequired && !resumeLower.includes(det.hardRequirements.degreeRequired.replace(/[^a-z]/g, ""))) {
        reqGaps.push(`Degree requirement detected (${det.hardRequirements.degreeRequired}); add it if you hold it.`);
      }
      for (const cert of det.hardRequirements.certsRequired) {
        if (!resumeLower.includes(cert)) reqGaps.push(`Certification mentioned: "${cert}" — list it if applicable.`);
      }

      const report = {
        overallScore,
        breakdown: {
          keywordCoverage: det.keyword.coverage,
          format: det.format.score,
          seniority: det.seniority.score,
          semantic: semanticScore,
        },
        keywordMatch: { matched: det.keyword.matched, missing: det.keyword.missing },
        formatIssues: det.format.issues,
        seniorityNote: det.seniority.note,
        hardRequirementGaps: reqGaps,
        strengths: semantic?.strengths ?? [],
        improvements: [
          ...(semantic?.prioritizedFixes ?? []),
          ...det.keyword.missing.slice(0, 8).map((k) => `Add or emphasize "${k}" if you have it.`),
        ],
      };

      return { success: true as const, content: JSON.stringify(report), error: null };
    }),

  analyzeVoice: authedProcedure
    .input(z.object({ samples: z.array(z.string().min(1)).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(voiceAnalysisMessages(input.samples));
    }),

  interviewQuestion: authedProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        role: z.string().min(1),
        interviewType: z.enum(["behavioral", "technical", "system-design"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(
        interviewQuestionMessages(
          input.companyName,
          input.role,
          input.interviewType,
        ),
      );
    }),

  chat: authedProcedure
    .input(chatMessagesInput)
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(input.messages);
    }),

  followUpEmail: authedProcedure
    .input(
      z.object({
        stage: z.string().min(1),
        company: z.string().min(1),
        role: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(followUpMessages(input));
    }),

  networkingMessage: authedProcedure
    .input(
      z.object({
        targetRole: z.string().min(1),
        targetCompany: z.string().min(1),
        background: z.string().min(1),
        messageType: z.enum([
          "linkedin_connection",
          "informational_interview",
          "warm_intro",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      return chatCompletion(networkingMessages(input));
    }),

  evaluateAnswer: authedProcedure
    .input(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        role: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const res = await chatCompletion(interviewEvalMessages(input));
      if (!res.success || !res.content) return res;
      const parsed = parseJsonFromAI(res.content);
      return {
        success: true as const,
        content: parsed ? JSON.stringify(parsed) : res.content,
        error: null,
      };
    }),

  skillGap: authedProcedure
    .input(
      z.object({
        resume: z.string().min(1),
        jobDescription: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const res = await chatCompletion(
        skillGapMessages(input.resume, input.jobDescription),
      );
      if (!res.success || !res.content) return res;
      const parsed = parseJsonFromAI(res.content);
      return {
        success: true as const,
        content: parsed ? JSON.stringify(parsed) : res.content,
        error: null,
      };
    }),
});
