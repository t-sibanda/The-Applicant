import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { resumeProfiles, profiles } from "../db/schema";

/**
 * The single source of truth for what the AI knows about a user when it writes.
 *
 * Every generation path (tailor resume, cover letter, ATS, the editing chat)
 * pulls context from here so results are consistent across pages and always
 * reflect the user's saved resume, structured voice, and profile targeting.
 * Reading server-side means the client never has to pass this data around, and
 * pages stay in sync automatically.
 */
export interface GenerationContext {
  hasResume: boolean;
  baseResume: string;
  /** Voice instruction string (derived from the structured voice profile). */
  voiceInstruction: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  /** Active targeting, folded into prompts so tailoring stays role-aware. */
  targetRole: string | null;
  targetIndustry: string | null;
  resumeProfileId: number | null;
}

const DEFAULT_VOICE =
  "Professional, results-driven, uses metrics and action verbs. Clear and concise. No em dashes.";

export async function getGenerationContext(userId: number): Promise<GenerationContext> {
  const db = getDb();
  const resume = (
    await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, userId)).limit(1)
  ).at(0);

  // The active target profile drives role/industry awareness.
  const active = (
    await db.select().from(profiles).where(eq(profiles.userId, userId))
  ).find((p) => p.isActive) ?? null;

  const contactBits = [
    resume?.fullName,
    resume?.email,
    resume?.phone,
  ].filter(Boolean);

  return {
    hasResume: !!resume?.baseResumeText?.trim(),
    baseResume: resume?.baseResumeText ?? "",
    voiceInstruction: resume?.voiceProfile?.trim() || DEFAULT_VOICE,
    fullName: resume?.fullName ?? null,
    email: resume?.email ?? null,
    phone: resume?.phone ?? null,
    targetRole: active?.targetRole ?? null,
    targetIndustry: active?.targetIndustry ?? null,
    resumeProfileId: resume?.id ?? null,
  };

  void contactBits;
}

/** A compact contact block for the top of a resume, if we have any details. */
export function contactBlock(ctx: GenerationContext): string | undefined {
  const bits = [ctx.fullName, ctx.email, ctx.phone].filter(Boolean);
  return bits.length ? bits.join(" | ") : undefined;
}

/** A short targeting note woven into prompts so output stays role-aware. */
export function targetingNote(ctx: GenerationContext): string {
  const bits: string[] = [];
  if (ctx.targetRole) bits.push(`Target role: ${ctx.targetRole}`);
  if (ctx.targetIndustry) bits.push(`Target industry: ${ctx.targetIndustry}`);
  return bits.join(". ");
}
