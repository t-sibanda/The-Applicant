import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { resumeProfiles } from "../db/schema";
import { chatCompletion, parseJsonFromAI, type ChatMessage } from "../services/ai";
import { requireFeature } from "../lib/entitlements";
import { TRPCError } from "@trpc/server";

/**
 * Voice Studio — the core differentiator. Produces a STRUCTURED voice profile
 * the user can read, pick from, blend, and refine via a feedback bot.
 */

export interface VoiceProfileJson {
  summary: string; // plain-English "how your voice sounds"
  toneTags: string[]; // e.g. ["confident", "warm", "direct"]
  signatureVerbs: string[]; // action verbs the person favors
  styleNotes: string[]; // sentence structure / patterns
  dos: string[];
  donts: string[];
  formality: number; // 0-100 (casual → formal)
  warmth: number; // 0-100 (reserved → warm)
  brevity: number; // 0-100 (elaborate → concise)
}

const voiceSchema = z.object({
  summary: z.string(),
  toneTags: z.array(z.string()),
  signatureVerbs: z.array(z.string()),
  styleNotes: z.array(z.string()),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
  formality: z.number().min(0).max(100),
  warmth: z.number().min(0).max(100),
  brevity: z.number().min(0).max(100),
});

async function getResume(userId: number) {
  const rows = await getDb().select().from(resumeProfiles).where(eq(resumeProfiles.userId, userId)).limit(1);
  return rows.at(0) ?? null;
}

// Convert a structured profile into a system-prompt instruction for generation.
export function voiceToInstruction(v: VoiceProfileJson): string {
  const scale = (n: number, low: string, high: string) =>
    n < 35 ? low : n > 65 ? high : `balanced ${low}/${high}`;
  return [
    `Write in this person's authentic voice.`,
    `Tone: ${v.toneTags.join(", ") || "professional"}.`,
    `Formality: ${scale(v.formality, "casual", "formal")}. Warmth: ${scale(v.warmth, "reserved", "warm")}. Brevity: ${scale(v.brevity, "elaborate", "concise")}.`,
    v.signatureVerbs.length ? `Favor verbs like: ${v.signatureVerbs.join(", ")}.` : "",
    v.styleNotes.length ? `Style: ${v.styleNotes.join("; ")}.` : "",
    v.dos.length ? `Do: ${v.dos.join("; ")}.` : "",
    v.donts.length ? `Avoid: ${v.donts.join("; ")}.` : "",
  ].filter(Boolean).join("\n");
}

const ANALYZE_SYSTEM =
  "You are an expert writing-style analyst. Analyze the samples and return ONLY valid JSON describing the person's voice. Be specific and honest; do not invent traits not present in the samples.";

function analyzePrompt(samples: string[]): ChatMessage[] {
  return [
    { role: "system", content: ANALYZE_SYSTEM },
    {
      role: "user",
      content: `Analyze these writing samples and return JSON:
{
  "summary": "2-3 sentence plain-English description of how this person's voice sounds",
  "toneTags": ["4-6 adjectives"],
  "signatureVerbs": ["6-10 action verbs they favor"],
  "styleNotes": ["3-5 notes on sentence structure/patterns"],
  "dos": ["3-5 things to keep doing"],
  "donts": ["3-5 things to avoid to stay authentic"],
  "formality": 0-100, "warmth": 0-100, "brevity": 0-100
}

SAMPLES:
${samples.join("\n\n---\n\n")}

Return ONLY valid JSON.`,
    },
  ];
}

export const voiceRouter = router({
  get: authedProcedure.query(async ({ ctx }) => {
    const r = await getResume(ctx.user.id);
    return {
      voiceJson: (r?.voiceJson as VoiceProfileJson | null) ?? null,
      voiceProfile: r?.voiceProfile ?? null,
    };
  }),

  // Analyze samples → structured profile (saved).
  analyze: authedProcedure
    .input(z.object({ samples: z.array(z.string().min(1)).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "aiOptimizer", "Voice analysis");
      const r = await getResume(ctx.user.id);
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create your resume first." });

      const res = await chatCompletion(analyzePrompt(input.samples), { maxTokens: 1500 });
      if (!res.success || !res.content) return { success: false as const, error: res.error };
      const parsed = parseJsonFromAI(res.content);
      const v = voiceSchema.safeParse(parsed);
      if (!v.success) return { success: false as const, error: "Could not read the voice analysis. Try again." };

      await getDb()
        .update(resumeProfiles)
        .set({ voiceJson: v.data, voiceProfile: voiceToInstruction(v.data) })
        .where(eq(resumeProfiles.id, r.id));
      return { success: true as const, voice: v.data };
    }),

  // Save manual edits (pick/blend/adjust sliders).
  save: authedProcedure
    .input(voiceSchema)
    .mutation(async ({ ctx, input }) => {
      const r = await getResume(ctx.user.id);
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create your resume first." });
      await getDb()
        .update(resumeProfiles)
        .set({ voiceJson: input, voiceProfile: voiceToInstruction(input) })
        .where(eq(resumeProfiles.id, r.id));
      return { success: true };
    }),

  // Feedback bot: refine the profile with the user's correction.
  refine: authedProcedure
    .input(z.object({ feedback: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "aiOptimizer", "Voice refinement");
      const r = await getResume(ctx.user.id);
      const current = (r?.voiceJson as VoiceProfileJson | null) ?? null;
      if (!current) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Analyze your voice first." });

      const res = await chatCompletion(
        [
          { role: "system", content: "You refine a structured voice profile based on the user's correction. Return ONLY the full updated JSON in the same shape." },
          {
            role: "user",
            content: `Current voice profile JSON:
${JSON.stringify(current)}

The user says: "${input.feedback}"

Apply their correction and return the FULL updated JSON (same fields). Return ONLY valid JSON.`,
          },
        ],
        { maxTokens: 1500 },
      );
      if (!res.success || !res.content) return { success: false as const, error: res.error };
      const parsed = parseJsonFromAI(res.content);
      const v = voiceSchema.safeParse(parsed);
      if (!v.success) return { success: false as const, error: "Could not apply the change. Try rephrasing." };

      await getDb()
        .update(resumeProfiles)
        .set({ voiceJson: v.data, voiceProfile: voiceToInstruction(v.data) })
        .where(eq(resumeProfiles.id, r!.id));
      return { success: true as const, voice: v.data };
    }),

  // "Try it": regenerate a short sample in the current voice for validation.
  preview: authedProcedure
    .input(z.object({ prompt: z.string().max(400).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "aiOptimizer", "Voice preview");
      const r = await getResume(ctx.user.id);
      const v = (r?.voiceJson as VoiceProfileJson | null) ?? null;
      if (!v) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Analyze your voice first." });
      const topic = input?.prompt || "a short professional summary introducing myself to a hiring manager";
      const res = await chatCompletion(
        [
          { role: "system", content: voiceToInstruction(v) },
          { role: "user", content: `Write ${topic} (3-4 sentences) in my voice.` },
        ],
        { maxTokens: 400 },
      );
      return res.success ? { success: true as const, text: res.content } : { success: false as const, error: res.error };
    }),
});
