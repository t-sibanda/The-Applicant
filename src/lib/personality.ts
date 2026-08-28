/**
 * Gamified personality discovery (client-side scoring).
 *
 * These are self-reflection quizzes built on well-known frameworks, DISC, the
 * Big Five (OCEAN), a work-values sort, and a Johari Window exercise. They are
 * for self-insight, NOT clinically validated assessments, and the UI says so.
 * Scoring is deterministic and runs in the browser (no AI cost).
 */

// ── DISC ── choose the option that fits best (forced choice).
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

// ── Big Five (OCEAN) ── agree/disagree on a 1-5 scale.
export type BigFiveDim = "O" | "C" | "E" | "A" | "N";
export interface BigFiveStatement {
  text: string;
  dim: BigFiveDim;
  reverse?: boolean; // reverse-scored item
}

export const BIG_FIVE_STATEMENTS: BigFiveStatement[] = [
  { text: "I love trying new ideas and experiences.", dim: "O" },
  { text: "I prefer routine over variety.", dim: "O", reverse: true },
  { text: "I follow through and stay organized.", dim: "C" },
  { text: "I often leave things to the last minute.", dim: "C", reverse: true },
  { text: "I feel energized around other people.", dim: "E" },
  { text: "I need quiet time to recharge.", dim: "E", reverse: true },
  { text: "I go out of my way to help others.", dim: "A" },
  { text: "I'll challenge people directly when needed.", dim: "A", reverse: true },
  { text: "I stay calm when things get stressful.", dim: "N", reverse: true },
  { text: "I worry about things going wrong.", dim: "N" },
];

export const BIG_FIVE_LABEL: Record<BigFiveDim, string> = {
  O: "Openness",
  C: "Conscientiousness",
  E: "Extraversion",
  A: "Agreeableness",
  N: "Emotional sensitivity",
};

export function scoreBigFive(answers: Record<number, number>) {
  const sums: Record<BigFiveDim, { total: number; n: number }> = {
    O: { total: 0, n: 0 }, C: { total: 0, n: 0 }, E: { total: 0, n: 0 },
    A: { total: 0, n: 0 }, N: { total: 0, n: 0 },
  };
  BIG_FIVE_STATEMENTS.forEach((s, i) => {
    const raw = answers[i];
    if (raw == null) return;
    const val = s.reverse ? 6 - raw : raw; // 1-5 → reverse
    sums[s.dim].total += val;
    sums[s.dim].n++;
  });
  const pct = (d: BigFiveDim) => (sums[d].n ? Math.round(((sums[d].total / sums[d].n - 1) / 4) * 100) : 50);
  return { O: pct("O"), C: pct("C"), E: pct("E"), A: pct("A"), N: pct("N") };
}

// ── Work values ── rank what matters (drag or pick top).
export const WORK_VALUES = [
  "Impact", "Autonomy", "Growth", "Stability", "Creativity",
  "Recognition", "Collaboration", "Balance", "Mastery", "Purpose",
] as const;

// ── Johari Window ── adjectives you pick for yourself (open/hidden), the rest
// can be added by peers via a share link (blind), see JohariShare.
export const JOHARI_ADJECTIVES = [
  "able", "adaptable", "bold", "calm", "caring", "cheerful", "clever",
  "confident", "dependable", "energetic", "focused", "friendly", "honest",
  "independent", "kind", "logical", "organized", "patient", "proud",
  "reflective", "resilient", "self-assertive", "sensible", "warm", "witty",
];
