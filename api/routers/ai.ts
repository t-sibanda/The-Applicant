import { z } from "zod";
import { router, authedProcedure } from "../trpc";
import { chatCompletion, parseJsonFromAI } from "../services/ai";
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
      const res = await chatCompletion(
        atsScoreMessages(input.resumeText, input.jobDescription),
      );
      if (!res.success || !res.content) return res;
      const parsed = parseJsonFromAI(res.content);
      return {
        success: true as const,
        content: parsed ? JSON.stringify(parsed) : res.content,
        error: null,
      };
    }),

  analyzeVoice: authedProcedure
    .input(z.object({ samples: z.array(z.string().min(1)).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
      requireAIEntitlement(ctx.user);
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
