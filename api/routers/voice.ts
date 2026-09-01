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

// ─── "Who is X?" persona + personality types ───

export interface PersonaJson {
  summary: string; // AI-written "who you are" description
  traits: string[]; // character/personality descriptors
  values: string[]; // what matters to the person
  strengths: string[];
  interests: string[];
  narrative: string; // the raw combined answers the user provided
}

const personaSchema = z.object({
  summary: z.string(),
  traits: z.array(z.string()),
  values: z.array(z.string()),
  strengths: z.array(z.string()),
  interests: z.array(z.string()),
  narrative: z.string(),
});

// Personality result stored from the gamified quizzes. Loosely validated so we
// can add or evolve frameworks without a migration. Covers the four workplace
// assessments (DISC, Talents, Social Style, Reputation) plus Johari.
const personalitySchema = z.object({
  disc: z.object({ D: z.number(), I: z.number(), S: z.number(), C: z.number(), primary: z.string() }).optional(),
  talents: z.object({
    scores: z.array(z.object({ talent: z.string(), pct: z.number() })),
    top: z.array(z.string()),
  }).optional(),
  social: z.object({ assert: z.number(), respond: z.number(), style: z.string() }).optional(),
  reputation: z.object({
    bright: z.array(z.object({ tag: z.string(), pct: z.number() })),
    dark: z.array(z.object({ tag: z.string(), pct: z.number() })),
    values: z.array(z.object({ tag: z.string(), pct: z.number() })),
  }).optional(),
  johari: z.object({ open: z.array(z.string()), hidden: z.array(z.string()), blind: z.array(z.string()) }).optional(),
  summary: z.string().optional(),
});

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

  // ─── "Who is X?" self-discovery ───

  // Read the saved persona + personality.
  getPersona: authedProcedure.query(async ({ ctx }) => {
    const r = await getResume(ctx.user.id);
    return {
      persona: (r?.personaJson as PersonaJson | null) ?? null,
      personality: (r?.personalityJson as z.infer<typeof personalitySchema> | null) ?? null,
    };
  }),

  // Build a persona from the user's answers (guided or freeform), then fold it
  // into the voice profile so writing reflects who they are, not just how they
  // write. Saves both the persona and an enriched voice instruction.
  buildPersona: authedProcedure
    .input(
      z.object({
        // The combined text the user provided (freeform, guided answers, or a
        // voice transcription they edited). We keep it human-authored.
        narrative: z.string().min(30).max(20000),
        name: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "aiOptimizer", "Persona discovery");
      const r = await getResume(ctx.user.id);
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create your resume first." });

      const res = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a warm, perceptive interviewer helping someone articulate who they are, for use in their job applications. From their own words, produce ONLY valid JSON. Use only what they actually said; never invent facts. Keep the summary in second person and affirming but honest.",
          },
          {
            role: "user",
            content: `Here is what ${input.name || "the person"} shared about themselves:

${input.narrative}

Return JSON:
{
  "summary": "3-5 sentence 'who you are' description in second person, grounded in their words",
  "traits": ["5-8 character/personality descriptors they revealed"],
  "values": ["3-6 things that clearly matter to them"],
  "strengths": ["3-6 strengths evident from what they said"],
  "interests": ["3-6 interests/passions they mentioned"],
  "narrative": ${JSON.stringify(input.narrative.slice(0, 6000))}
}
Return ONLY valid JSON.`,
          },
        ],
        { maxTokens: 1200 },
      );
      if (!res.success || !res.content) return { success: false as const, error: res.error };
      const parsed = parseJsonFromAI(res.content);
      const p = personaSchema.safeParse(parsed);
      if (!p.success) return { success: false as const, error: "Could not build your persona. Try again." };

      // Enrich the voice instruction with the persona so generated documents
      // reflect the person, while keeping the structured voice profile intact.
      const v = (r.voiceJson as VoiceProfileJson | null) ?? null;
      const enriched = v
        ? `${voiceToInstruction(v)}\n\nWHO THEY ARE: ${p.data.summary} Values: ${p.data.values.join(", ")}. Strengths: ${p.data.strengths.join(", ")}.`
        : `Write in the authentic voice of this person.\nWHO THEY ARE: ${p.data.summary} Values: ${p.data.values.join(", ")}. Strengths: ${p.data.strengths.join(", ")}.`;

      await getDb()
        .update(resumeProfiles)
        .set({ personaJson: p.data, voiceProfile: enriched })
        .where(eq(resumeProfiles.id, r.id));
      return { success: true as const, persona: p.data };
    }),

  // Guided follow-up: the persona bot asks the next best question given what's
  // been shared so far, to draw out more character. No storage, just a prompt.
  personaNextQuestion: authedProcedure
    .input(z.object({ soFar: z.string().max(20000) }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.user, "aiOptimizer", "Persona discovery");
      const res = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a warm interviewer helping someone describe who they are for their job search. Ask ONE short, specific, open question that draws out character, values, or a defining story. Do not repeat topics already covered. Output only the question.",
          },
          { role: "user", content: `What they've shared so far:\n${input.soFar || "(nothing yet)"}\n\nAsk the next question.` },
        ],
        { maxTokens: 120 },
      );
      return res.success ? { success: true as const, question: (res.content ?? "").trim() } : { success: false as const, error: res.error };
    }),

  // Save gamified personality results and fold a one-line summary into voice.
  savePersonality: authedProcedure
    .input(personalitySchema)
    .mutation(async ({ ctx, input }) => {
      const r = await getResume(ctx.user.id);
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create your resume first." });
      await getDb()
        .update(resumeProfiles)
        .set({ personalityJson: input })
        .where(eq(resumeProfiles.id, r.id));
      return { success: true as const };
    }),
});
