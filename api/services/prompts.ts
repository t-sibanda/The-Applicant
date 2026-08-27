import type { ChatMessage } from "./ai";

// Company style adjustments for tailored output.
export type CompanyStyle =
  | "formal_corporate"
  | "startup_energy"
  | "faang_precision"
  | "mission_driven"
  | "casual_collaborative";

const STYLE_GUIDES: Record<CompanyStyle, string> = {
  formal_corporate:
    "Use formal, polished language. Avoid contractions. Emphasize process and measurable outcomes.",
  startup_energy:
    "Be energetic, direct, and bold. Short sentences. Show ownership and versatility.",
  faang_precision:
    "Be structured and data-driven. Lead with metrics, scale, and systems thinking.",
  mission_driven:
    "Emphasize purpose and values alignment. Connect work to a broader mission.",
  casual_collaborative:
    "Be conversational and warm. Use 'we' language and show teamwork.",
};

export function styleInstruction(style?: CompanyStyle): string {
  if (!style || !STYLE_GUIDES[style]) return "";
  return `\n\nWRITING STYLE:\n${STYLE_GUIDES[style]}\nKeep all content factually accurate.\n`;
}

export function parseJobMessages(description: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You extract structured requirements from job descriptions for ATS optimization. Return ONLY valid JSON.",
    },
    {
      role: "user",
      content: `Analyze this job description and return JSON:
{
  "hardSkills": [], "softSkills": [], "tools": [], "certifications": [],
  "yearsExperience": "", "educationLevel": "", "keyResponsibilities": [], "keywords": []
}

Job Description:
${description}

Return ONLY valid JSON, no markdown.`,
    },
  ];
}

export function tailorResumeMessages(args: {
  baseResume: string;
  voiceProfile: string;
  jobDescription: string;
  style?: CompanyStyle;
  contact?: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an expert resume writer. Output ONLY the complete, ATS-friendly resume as plain text. No JSON, no code fences, no commentary.",
    },
    {
      role: "user",
      content: `Create a COMPLETE tailored resume the applicant can submit directly.${styleInstruction(
        args.style,
      )}

${args.contact ? `CONTACT:\n${args.contact}\n` : ""}
VOICE PROFILE (write in this style):
${args.voiceProfile}

BASE RESUME:
${args.baseResume}

TARGET JOB DESCRIPTION:
${args.jobDescription}

Rules: use only real information from the base resume (never fabricate); weave in job keywords naturally; quantify where possible; clear CAPS section headers; no tables/columns/graphics; include all contact info at top. Output plain text only.`,
    },
  ];
}

export function coverLetterMessages(args: {
  baseResume: string;
  voiceProfile: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  style?: CompanyStyle;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You write personalized, compelling cover letters in the applicant's authentic voice.",
    },
    {
      role: "user",
      content: `Write a 250-350 word cover letter.${styleInstruction(args.style)}
APPLICANT VOICE:
${args.voiceProfile}

APPLICANT BACKGROUND:
${args.baseResume}

COMPANY: ${args.companyName}
ROLE: ${args.jobTitle}

JOB DESCRIPTION:
${args.jobDescription}

Open with a strong hook, highlight 2-3 relevant achievements, show company knowledge, close with a clear call to action. Avoid generic templates.`,
    },
  ];
}

export function atsScoreMessages(
  resumeText: string,
  jobDescription: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an ATS optimization expert. Return ONLY valid JSON scoring the resume against the job.",
    },
    {
      role: "user",
      content: `Return JSON:
{
  "overallScore": 0,
  "keywordMatch": { "score": 0, "matched": [], "missing": [] },
  "formatting": { "score": 0, "issues": [] },
  "semanticMatch": { "score": 0, "analysis": "" },
  "improvements": []
}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON.`,
    },
  ];
}

export function voiceAnalysisMessages(samples: string[]): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a writing-style analyst. Produce a reusable voice profile describing tone, sentence structure, verb choices, and patterns.",
    },
    {
      role: "user",
      content: `Analyze these writing samples and produce a comprehensive voice profile usable as an AI system prompt:\n\n${samples.join(
        "\n\n---\n\n",
      )}`,
    },
  ];
}

export function interviewQuestionMessages(
  companyName: string,
  role: string,
  interviewType: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are a senior interviewer at ${companyName}. Ask one focused, realistic ${interviewType} question for the ${role} role. Output only the question.`,
    },
    { role: "user", content: "Ask the question." },
  ];
}

export function followUpMessages(args: {
  stage: string;
  company: string;
  role: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You write concise, effective job-application follow-up emails that get responses without being pushy.",
    },
    {
      role: "user",
      content: `Write a follow-up email.
Stage: ${args.stage}
Company: ${args.company}
Role: ${args.role}

Include a subject line prefixed with "Subject: ", then a blank line, then a brief 3-5 sentence body with a soft call to action.`,
    },
  ];
}

export function networkingMessages(args: {
  targetRole: string;
  targetCompany: string;
  background: string;
  messageType: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You write authentic, specific networking messages that get responses. Prioritize brevity.",
    },
    {
      role: "user",
      content: `Write a ${args.messageType} networking message.
Target: ${args.targetRole} at ${args.targetCompany}
My background: ${args.background}

Keep it genuine, specific, and concise. For LinkedIn connections, stay under 300 characters.`,
    },
  ];
}

export function interviewEvalMessages(args: {
  question: string;
  answer: string;
  role: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an expert interviewer giving constructive feedback. Return ONLY valid JSON.",
    },
    {
      role: "user",
      content: `Evaluate this interview answer for a ${args.role} role.
QUESTION: ${args.question}
ANSWER: ${args.answer}

Return JSON:
{ "score": 0, "maxScore": 10, "feedback": "", "strengths": [], "improvements": [], "improvedAnswer": "" }
Return ONLY valid JSON.`,
    },
  ];
}

export function skillGapMessages(
  resume: string,
  jobDescription: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a career development advisor. Identify skill gaps and a learning plan. Return ONLY valid JSON.",
    },
    {
      role: "user",
      content: `Compare this resume to the job and identify gaps.
RESUME:
${resume}

JOB:
${jobDescription}

Return JSON:
{ "matchingSkills": [], "missingSkills": [], "learningPlan": [{"skill":"","how":"","weeks":0}], "readinessScore": 0 }
Return ONLY valid JSON.`,
    },
  ];
}
