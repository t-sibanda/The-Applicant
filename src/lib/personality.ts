/**
 * Gamified workplace personality discovery (client-side scoring).
 *
 * Four in-depth self-reflection quizzes, ~10 questions each, INSPIRED BY the
 * well-known workplace frameworks below. These are original items for
 * self-insight, NOT the licensed instruments (DiSC®, CliftonStrengths®,
 * TRACOM SOCIAL STYLE®, Hogan® are trademarks of their owners and are not
 * reproduced here). The UI states this clearly.
 *
 *  - DISC: behavioral style & communication (day-to-day collaboration)
 *  - Talents: natural talents & performance (CliftonStrengths-style)
 *  - Social Style: workplace communication (TRACOM-style)
 *  - Reputation: professional reputation & risks (Hogan-style)
 *
 * Scoring is deterministic and runs in the browser (no AI cost).
 */

// ─────────────────────────── DISC ───────────────────────────
export type Disc = "D" | "I" | "S" | "C";
export interface DiscQuestion {
  prompt: string;
  options: { label: string; type: Disc }[];
}

export const DISC_QUESTIONS: DiscQuestion[] = [
  {
    prompt: "At work, you're happiest when you're…",
    options: [
      { label: "Driving results and making the call", type: "D" },
      { label: "Rallying people around an idea", type: "I" },
      { label: "Supporting the team and keeping things steady", type: "S" },
      { label: "Getting the details exactly right", type: "C" },
    ],
  },
  {
    prompt: "Under pressure, you tend to…",
    options: [
      { label: "Take charge and push through", type: "D" },
      { label: "Talk it out and stay optimistic", type: "I" },
      { label: "Stay calm and steady the ship", type: "S" },
      { label: "Slow down and check the facts", type: "C" },
    ],
  },
  {
    prompt: "People would describe you as…",
    options: [
      { label: "Direct and decisive", type: "D" },
      { label: "Enthusiastic and persuasive", type: "I" },
      { label: "Patient and dependable", type: "S" },
      { label: "Precise and analytical", type: "C" },
    ],
  },
  {
    prompt: "A great project for you has…",
    options: [
      { label: "Ambitious goals and autonomy", type: "D" },
      { label: "Lots of collaboration and energy", type: "I" },
      { label: "A clear plan and a solid team", type: "S" },
      { label: "High standards and clear criteria", type: "C" },
    ],
  },
  {
    prompt: "You're most frustrated by…",
    options: [
      { label: "Indecision and slow progress", type: "D" },
      { label: "Rigid rules and no room to connect", type: "I" },
      { label: "Constant change and conflict", type: "S" },
      { label: "Sloppiness and vague expectations", type: "C" },
    ],
  },
  {
    prompt: "In a disagreement with a coworker, you…",
    options: [
      { label: "State your position and press for a decision", type: "D" },
      { label: "Keep it warm and look for common ground", type: "I" },
      { label: "Listen first and avoid escalating", type: "S" },
      { label: "Bring data and logic to settle it", type: "C" },
    ],
  },
  {
    prompt: "Your inbox and to-do list are…",
    options: [
      { label: "A list of outcomes I'm chasing", type: "D" },
      { label: "Full of people I need to reply to", type: "I" },
      { label: "Steady and predictable, how I like it", type: "S" },
      { label: "Meticulously organized and labeled", type: "C" },
    ],
  },
  {
    prompt: "When you join a new team, you first…",
    options: [
      { label: "Look for where you can make an impact fast", type: "D" },
      { label: "Get to know everyone and build rapport", type: "I" },
      { label: "Learn the rhythm and fit in smoothly", type: "S" },
      { label: "Study how things work before acting", type: "C" },
    ],
  },
  {
    prompt: "Feedback lands best with you when it's…",
    options: [
      { label: "Blunt and to the point", type: "D" },
      { label: "Encouraging and delivered warmly", type: "I" },
      { label: "Gentle and given privately", type: "S" },
      { label: "Specific, with clear examples", type: "C" },
    ],
  },
  {
    prompt: "Your ideal pace at work is…",
    options: [
      { label: "Fast, I like momentum", type: "D" },
      { label: "Lively, with variety and people", type: "I" },
      { label: "Steady and sustainable", type: "S" },
      { label: "Deliberate, measured, and careful", type: "C" },
    ],
  },
];

export const DISC_LABEL: Record<Disc, string> = {
  D: "Dominance — driven, decisive, results-focused",
  I: "Influence — outgoing, persuasive, people-first",
  S: "Steadiness — patient, dependable, supportive",
  C: "Conscientiousness — precise, analytical, quality-focused",
};

export function scoreDisc(answers: Disc[]) {
  const c = { D: 0, I: 0, S: 0, C: 0 };
  for (const a of answers) c[a]++;
  const primary = (Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "D") as Disc;
  const total = answers.length || 1;
  return {
    D: Math.round((c.D / total) * 100),
    I: Math.round((c.I / total) * 100),
    S: Math.round((c.S / total) * 100),
    C: Math.round((c.C / total) * 100),
    primary,
  };
}

// ───────────────── Talents (CliftonStrengths-style) ─────────────────
// Rate how well each statement fits (1-5). Each maps to a talent theme; the
// top themes are the person's natural strengths at work.
export type Talent =
  | "Achiever" | "Strategic" | "Relator" | "Learner" | "Activator"
  | "Analytical" | "Communication" | "Responsibility" | "Ideation" | "Harmony";

export interface TalentStatement { text: string; talent: Talent }

export const TALENT_STATEMENTS: TalentStatement[] = [
  { text: "I feel a strong need to accomplish something every day.", talent: "Achiever" },
  { text: "I naturally spot patterns and the best path forward.", talent: "Strategic" },
  { text: "I build deep, trusting relationships with a few people.", talent: "Relator" },
  { text: "I love learning for its own sake, the process energizes me.", talent: "Learner" },
  { text: "I turn talk into action and get things moving.", talent: "Activator" },
  { text: "I question assumptions and want proof before I believe.", talent: "Analytical" },
  { text: "I find the right words and enjoy explaining things.", talent: "Communication" },
  { text: "When I commit to something, I own it completely.", talent: "Responsibility" },
  { text: "My mind overflows with ideas and new possibilities.", talent: "Ideation" },
  { text: "I look for consensus and steer around needless conflict.", talent: "Harmony" },
];

export const TALENT_LABEL: Record<Talent, string> = {
  Achiever: "Achiever — drive and stamina to get things done",
  Strategic: "Strategic — sees the best route through complexity",
  Relator: "Relator — deep, trusted working relationships",
  Learner: "Learner — thrives on growth and new skills",
  Activator: "Activator — turns ideas into action",
  Analytical: "Analytical — rigorous, evidence-led thinking",
  Communication: "Communication — brings ideas to life in words",
  Responsibility: "Responsibility — dependable ownership",
  Ideation: "Ideation — a fountain of new ideas",
  Harmony: "Harmony — builds consensus and calm",
};

export function scoreTalents(answers: Record<number, number>) {
  const scores = TALENT_STATEMENTS.map((s, i) => ({
    talent: s.talent,
    pct: answers[i] != null ? Math.round(((answers[i] - 1) / 4) * 100) : 0,
  }));
  const top = [...scores].sort((a, b) => b.pct - a.pct).slice(0, 5).map((s) => s.talent);
  return { scores, top };
}

// ───────────────── Social Style (TRACOM-style) ─────────────────
// Two axes: Assertiveness (ask ↔ tell) and Responsiveness (control ↔ emote).
// The quadrant gives a style: Driver, Expressive, Amiable, Analytical.
export type Axis = "assert" | "respond";
export interface SocialQuestion {
  prompt: string;
  // left option lowers the axis, right raises it
  left: string;
  right: string;
  axis: Axis;
}

export const SOCIAL_QUESTIONS: SocialQuestion[] = [
  { axis: "assert", prompt: "In meetings, you're more likely to…", left: "Ask questions and listen", right: "State views and direct" },
  { axis: "assert", prompt: "Your speaking pace and tone is…", left: "Measured and quiet", right: "Fast and forceful" },
  { axis: "assert", prompt: "When a decision is needed, you…", left: "Let it develop", right: "Push to decide now" },
  { axis: "assert", prompt: "You'd rather…", left: "Be asked for input", right: "Take the lead" },
  { axis: "assert", prompt: "Your emails tend to be…", left: "Careful and hedged", right: "Short and direct" },
  { axis: "respond", prompt: "You show emotion at work…", left: "Rarely, you stay composed", right: "Openly, you're expressive" },
  { axis: "respond", prompt: "You focus more on…", left: "The task and the facts", right: "The people and the mood" },
  { axis: "respond", prompt: "Small talk with colleagues is…", left: "Not really your thing", right: "Something you enjoy" },
  { axis: "respond", prompt: "Your workspace and style are…", left: "Businesslike and neutral", right: "Personal and warm" },
  { axis: "respond", prompt: "You make decisions more on…", left: "Logic and evidence", right: "Gut and relationships" },
];

export function scoreSocial(answers: Record<number, number>) {
  // Each answer is 0 (left) or 1 (right).
  let assertN = 0, assertSum = 0, respN = 0, respSum = 0;
  SOCIAL_QUESTIONS.forEach((q, i) => {
    const v = answers[i];
    if (v == null) return;
    if (q.axis === "assert") { assertSum += v; assertN++; }
    else { respSum += v; respN++; }
  });
  const assert = assertN ? Math.round((assertSum / assertN) * 100) : 50; // higher = tell
  const respond = respN ? Math.round((respSum / respN) * 100) : 50; // higher = emote
  const style =
    assert >= 50 && respond < 50 ? "Driver"
      : assert >= 50 && respond >= 50 ? "Expressive"
        : assert < 50 && respond >= 50 ? "Amiable"
          : "Analytical";
  return { assert, respond, style };
}

export const SOCIAL_STYLE_LABEL: Record<string, string> = {
  Driver: "Driver — decisive, task-focused, fast-paced. Adapt by being brief and results-first.",
  Expressive: "Expressive — outgoing, big-picture, energetic. Adapt by being enthusiastic and personal.",
  Amiable: "Amiable — warm, cooperative, relationship-first. Adapt by being patient and supportive.",
  Analytical: "Analytical — precise, careful, evidence-led. Adapt by being thorough and factual.",
};

// ───────────────── Reputation (Hogan-style) ─────────────────
// Three lenses: bright side (everyday reputation), dark side (stress
// derailers), and values (core drivers). Agree/disagree 1-5.
export type RepDim = "bright" | "dark" | "values";
export interface RepStatement { text: string; dim: RepDim; tag: string }

export const REP_STATEMENTS: RepStatement[] = [
  // Bright side (strengths others see)
  { text: "Colleagues see me as calm and dependable under normal conditions.", dim: "bright", tag: "Steady" },
  { text: "People say I'm ambitious and take initiative.", dim: "bright", tag: "Ambitious" },
  { text: "I'm known for being sociable and easy to approach.", dim: "bright", tag: "Sociable" },
  { text: "I'm seen as prudent and careful with decisions.", dim: "bright", tag: "Prudent" },
  // Dark side (what shows up under stress)
  { text: "Under pressure I can become blunt or impatient with others.", dim: "dark", tag: "Volatile" },
  { text: "When stressed I may resist input and go it alone.", dim: "dark", tag: "Bold" },
  { text: "I sometimes over-check work and struggle to delegate.", dim: "dark", tag: "Diligent" },
  { text: "Under strain I can withdraw and avoid confrontation.", dim: "dark", tag: "Reserved" },
  // Values (core drivers)
  { text: "Achievement and recognition genuinely motivate me.", dim: "values", tag: "Achievement" },
  { text: "Helping others and a sense of purpose drive me most.", dim: "values", tag: "Altruism" },
];

export function scoreReputation(answers: Record<number, number>) {
  const bright: { tag: string; pct: number }[] = [];
  const dark: { tag: string; pct: number }[] = [];
  const values: { tag: string; pct: number }[] = [];
  REP_STATEMENTS.forEach((s, i) => {
    const pct = answers[i] != null ? Math.round(((answers[i] - 1) / 4) * 100) : 0;
    const row = { tag: s.tag, pct };
    if (s.dim === "bright") bright.push(row);
    else if (s.dim === "dark") dark.push(row);
    else values.push(row);
  });
  return { bright, dark, values };
}

// ─────────────────────────── Johari ───────────────────────────
export const JOHARI_ADJECTIVES = [
  "able", "adaptable", "bold", "calm", "caring", "cheerful", "clever",
  "confident", "dependable", "energetic", "focused", "friendly", "honest",
  "independent", "kind", "logical", "organized", "patient", "proud",
  "reflective", "resilient", "self-assertive", "sensible", "warm", "witty",
];
