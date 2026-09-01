import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Gamepad2, Loader2, Check, ArrowRight, RotateCcw, Save, Sparkles,
} from "lucide-react";
import {
  DISC_QUESTIONS, DISC_LABEL, scoreDisc, type Disc,
  TALENT_STATEMENTS, TALENT_LABEL, scoreTalents,
  SOCIAL_QUESTIONS, SOCIAL_STYLE_LABEL, scoreSocial,
  REP_STATEMENTS, scoreReputation,
  JOHARI_ADJECTIVES,
} from "@/lib/personality";

type Stage = "menu" | "disc" | "talents" | "social" | "reputation" | "johari" | "done";

function Bar({ label, pct, color = "var(--brand)" }: { label: string; pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-44 shrink-0 text-xs text-slate-600 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-9 text-right text-[11px] text-slate-400">{pct}%</div>
    </div>
  );
}

/** 1-5 agree/disagree row. */
function LikertRow({ text, value, onPick }: { text: string; value?: number; onPick: (v: number) => void }) {
  return (
    <div>
      <p className="text-sm text-slate-700 mb-1">{text}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} onClick={() => onPick(v)}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${value === v ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PersonalityGames() {
  const utils = trpc.useUtils();
  const personaQuery = trpc.voice.getPersona.useQuery();
  const savePersonality = trpc.voice.savePersonality.useMutation();

  const saved = personaQuery.data?.personality as any;
  const [stage, setStage] = useState<Stage>("menu");

  // DISC
  const [discIdx, setDiscIdx] = useState(0);
  const [discAns, setDiscAns] = useState<Disc[]>([]);
  // Talents
  const [talentAns, setTalentAns] = useState<Record<number, number>>({});
  // Social Style (0 = left, 1 = right)
  const [socialAns, setSocialAns] = useState<Record<number, number>>({});
  // Reputation
  const [repAns, setRepAns] = useState<Record<number, number>>({});
  // Johari
  const [johariOpen, setJohariOpen] = useState<string[]>([]);
  const [johariHidden, setJohariHidden] = useState<string[]>([]);

  const disc = discAns.length === DISC_QUESTIONS.length ? scoreDisc(discAns) : saved?.disc;
  const talents = Object.keys(talentAns).length === TALENT_STATEMENTS.length ? scoreTalents(talentAns) : saved?.talents;
  const social = Object.keys(socialAns).length === SOCIAL_QUESTIONS.length ? scoreSocial(socialAns) : saved?.social;
  const reputation = Object.keys(repAns).length === REP_STATEMENTS.length ? scoreReputation(repAns) : saved?.reputation;

  const toggleJohari = (a: string, bucket: "open" | "hidden") => {
    const [list, setList, other, setOther] = bucket === "open"
      ? [johariOpen, setJohariOpen, johariHidden, setJohariHidden] as const
      : [johariHidden, setJohariHidden, johariOpen, setJohariOpen] as const;
    if (list.includes(a)) setList(list.filter((x) => x !== a));
    else { setList([...list, a]); if (other.includes(a)) setOther(other.filter((x) => x !== a)); }
  };

  const saveAll = async () => {
    const payload: any = {};
    if (disc) payload.disc = disc;
    if (talents) payload.talents = talents;
    if (social) payload.social = social;
    if (reputation) payload.reputation = reputation;
    if (johariOpen.length || johariHidden.length) payload.johari = { open: johariOpen, hidden: johariHidden, blind: [] };
    const bits: string[] = [];
    if (disc) bits.push(`DISC ${disc.primary}`);
    if (social) bits.push(`${social.style} style`);
    if (talents) bits.push(`top talents ${talents.top.slice(0, 3).join(", ")}`);
    payload.summary = bits.join("; ");
    if (Object.keys(payload).length <= 1) return toast.error("Play at least one assessment first");
    await savePersonality.mutateAsync(payload);
    await utils.voice.getPersona.invalidate();
    toast.success("Saved. This informs your voice and growth plan.");
    setStage("done");
  };

  // ── Menu ──
  if (stage === "menu") {
    return (
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Workplace personality discovery</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Four in-depth assessments map how you work, communicate, and lead. Inspired by well-known workplace frameworks, for self-insight, not the licensed tests. Results sharpen your voice and growth plan.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { id: "disc", t: "DISC style", d: "Behavioral style & communication", done: !!saved?.disc },
            { id: "talents", t: "Natural talents", d: "Your strengths & performance", done: !!saved?.talents },
            { id: "social", t: "Social Style", d: "How you communicate & adapt", done: !!saved?.social },
            { id: "reputation", t: "Work reputation", d: "Strengths, stress triggers, drivers", done: !!saved?.reputation },
            { id: "johari", t: "Johari Window", d: "Seen vs unseen self", done: !!saved?.johari },
          ].map((g) => (
            <button key={g.id} onClick={() => setStage(g.id as Stage)} className="tile bg-slate-50 text-left flex items-start gap-2">
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">{g.t}{g.done && <Check className="w-3.5 h-3.5 text-emerald-500" />}</div>
                <div className="text-xs text-slate-500">{g.d}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 mt-0.5" />
            </button>
          ))}
        </div>
        {saved && (
          <div className="rounded-xl bg-slate-50 p-3 mt-3 text-xs text-slate-600">
            <span className="font-semibold">Saved:</span> {saved.summary || "results recorded"}.
            <button onClick={() => setStage("done")} className="text-brand font-semibold ml-2">View snapshot</button>
          </div>
        )}
      </div>
    );
  }

  // ── DISC ──
  if (stage === "disc") {
    const q = DISC_QUESTIONS[discIdx];
    const finished = discAns.length === DISC_QUESTIONS.length;
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="DISC style" subtitle="Day-to-day collaboration" step={`${Math.min(discIdx + 1, DISC_QUESTIONS.length)}/${DISC_QUESTIONS.length}`} onBack={() => setStage("menu")} />
        {!finished ? (
          <>
            <p className="font-semibold text-sm text-slate-800 mb-3">{q.prompt}</p>
            <div className="space-y-2">
              {q.options.map((o) => (
                <button key={o.type} onClick={() => { setDiscAns([...discAns, o.type]); setDiscIdx((i) => i + 1); }}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-brand-light hover:text-brand text-sm text-slate-700 transition-all">
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : disc && (
          <div>
            {(["D", "I", "S", "C"] as Disc[]).map((k) => <Bar key={k} label={DISC_LABEL[k]} pct={disc[k]} />)}
            <div className="rounded-lg bg-brand-light text-brand text-xs font-semibold p-2 mt-2">Primary style: {DISC_LABEL[disc.primary as Disc]}</div>
            <FinishButtons onRetake={() => { setDiscAns([]); setDiscIdx(0); }} onDone={() => setStage("menu")} />
          </div>
        )}
      </div>
    );
  }

  // ── Talents (CliftonStrengths-style) ──
  if (stage === "talents") {
    const finished = Object.keys(talentAns).length === TALENT_STATEMENTS.length;
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Natural talents" subtitle="Strengths & performance" step={`${Object.keys(talentAns).length}/${TALENT_STATEMENTS.length}`} onBack={() => setStage("menu")} />
        {!finished ? (
          <div className="space-y-3">
            {TALENT_STATEMENTS.map((s, i) => (
              <LikertRow key={i} text={s.text} value={talentAns[i]} onPick={(v) => setTalentAns((a) => ({ ...a, [i]: v }))} />
            ))}
            <div className="flex justify-between text-[10px] text-slate-400"><span>Not me</span><span>Very me</span></div>
          </div>
        ) : talents && (
          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-1">Your top talents</div>
            {talents.top.map((t: string) => <div key={t} className="rounded-lg bg-brand-light text-brand text-xs font-semibold p-2 mb-1">{TALENT_LABEL[t as keyof typeof TALENT_LABEL]}</div>)}
            <FinishButtons onRetake={() => setTalentAns({})} onDone={() => setStage("menu")} />
          </div>
        )}
      </div>
    );
  }

  // ── Social Style (TRACOM-style) ──
  if (stage === "social") {
    const finished = Object.keys(socialAns).length === SOCIAL_QUESTIONS.length;
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Social Style" subtitle="Communication & adapting" step={`${Object.keys(socialAns).length}/${SOCIAL_QUESTIONS.length}`} onBack={() => setStage("menu")} />
        {!finished ? (
          <div className="space-y-3">
            {SOCIAL_QUESTIONS.map((q, i) => (
              <div key={i}>
                <p className="text-sm text-slate-700 mb-1">{q.prompt}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[[0, q.left], [1, q.right]].map(([v, label]: any) => (
                    <button key={v} onClick={() => setSocialAns((a) => ({ ...a, [i]: v }))}
                      className={`p-2.5 rounded-xl text-xs font-medium text-left transition-all ${socialAns[i] === v ? "bg-brand text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : social && (
          <div>
            <Bar label="Assertiveness (ask → tell)" pct={social.assert} />
            <Bar label="Responsiveness (control → emote)" pct={social.respond} color="#7c3aed" />
            <div className="rounded-lg bg-brand-light text-brand text-xs font-semibold p-2 mt-2">{SOCIAL_STYLE_LABEL[social.style]}</div>
            <FinishButtons onRetake={() => setSocialAns({})} onDone={() => setStage("menu")} />
          </div>
        )}
      </div>
    );
  }

  // ── Reputation (Hogan-style) ──
  if (stage === "reputation") {
    const finished = Object.keys(repAns).length === REP_STATEMENTS.length;
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Work reputation" subtitle="Strengths, stress triggers, drivers" step={`${Object.keys(repAns).length}/${REP_STATEMENTS.length}`} onBack={() => setStage("menu")} />
        {!finished ? (
          <div className="space-y-3">
            {REP_STATEMENTS.map((s, i) => (
              <LikertRow key={i} text={s.text} value={repAns[i]} onPick={(v) => setRepAns((a) => ({ ...a, [i]: v }))} />
            ))}
            <div className="flex justify-between text-[10px] text-slate-400"><span>Disagree</span><span>Agree</span></div>
          </div>
        ) : reputation && (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-bold text-emerald-600 mb-1">Bright side — your everyday reputation</div>
              {reputation.bright.map((r: any) => <Bar key={r.tag} label={r.tag} pct={r.pct} color="#059669" />)}
            </div>
            <div>
              <div className="text-[11px] font-bold text-rose-500 mb-1">Watch under stress — potential derailers</div>
              {reputation.dark.map((r: any) => <Bar key={r.tag} label={r.tag} pct={r.pct} color="#e11d48" />)}
            </div>
            <div>
              <div className="text-[11px] font-bold text-violet-600 mb-1">Core drivers</div>
              {reputation.values.map((r: any) => <Bar key={r.tag} label={r.tag} pct={r.pct} color="#7c3aed" />)}
            </div>
            <FinishButtons onRetake={() => setRepAns({})} onDone={() => setStage("menu")} />
          </div>
        )}
      </div>
    );
  }

  // ── Johari ──
  if (stage === "johari") {
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Johari Window" subtitle="Seen vs unseen self" step={`${johariOpen.length + johariHidden.length}`} onBack={() => setStage("menu")} />
        <p className="text-xs text-slate-500 mb-3">
          Pick words that describe you. Mark each as <span className="font-semibold text-emerald-600">Open</span> (others see it too) or <span className="font-semibold text-violet-600">Hidden</span> (true, but private). What peers add later becomes your "blind" quadrant.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {JOHARI_ADJECTIVES.map((a) => {
            const inOpen = johariOpen.includes(a);
            const inHidden = johariHidden.includes(a);
            return (
              <span key={a} className="inline-flex rounded-lg overflow-hidden border border-slate-200">
                <button onClick={() => toggleJohari(a, "open")} className={`px-2 py-1 text-[11px] font-semibold ${inOpen ? "bg-emerald-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{a}</button>
                <button onClick={() => toggleJohari(a, "hidden")} title="Keep private" className={`px-1.5 py-1 text-[11px] ${inHidden ? "bg-violet-500 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}>🔒</button>
              </span>
            );
          })}
        </div>
        <button onClick={() => setStage("menu")} className="btn-primary mt-4">Done</button>
      </div>
    );
  }

  // ── Results / done ──
  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Your workplace personality snapshot</h3></div>
      {disc && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-slate-500 mb-1">DISC style</div>
          {(["D", "I", "S", "C"] as Disc[]).map((k) => <Bar key={k} label={DISC_LABEL[k]} pct={disc[k]} />)}
        </div>
      )}
      {talents && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-slate-500 mb-1">Top talents</div>
          <div className="flex flex-wrap gap-1.5">{talents.top.map((t: string) => <span key={t} className="chip bg-brand-light text-brand">{t}</span>)}</div>
        </div>
      )}
      {social && (
        <div className="mb-4">
          <div className="text-[11px] font-bold text-slate-500 mb-1">Social Style</div>
          <div className="rounded-lg bg-slate-50 text-slate-700 text-xs p-2">{SOCIAL_STYLE_LABEL[social.style]}</div>
        </div>
      )}
      {reputation && (
        <div className="mb-4 grid sm:grid-cols-3 gap-3">
          <div><div className="text-[11px] font-bold text-emerald-600 mb-1">Bright side</div><div className="flex flex-wrap gap-1">{reputation.bright.filter((r: any) => r.pct >= 50).map((r: any) => <span key={r.tag} className="chip bg-emerald-100 text-emerald-700">{r.tag}</span>)}</div></div>
          <div><div className="text-[11px] font-bold text-rose-500 mb-1">Stress triggers</div><div className="flex flex-wrap gap-1">{reputation.dark.filter((r: any) => r.pct >= 50).map((r: any) => <span key={r.tag} className="chip bg-rose-100 text-rose-600">{r.tag}</span>)}</div></div>
          <div><div className="text-[11px] font-bold text-violet-600 mb-1">Drivers</div><div className="flex flex-wrap gap-1">{reputation.values.filter((r: any) => r.pct >= 50).map((r: any) => <span key={r.tag} className="chip bg-violet-100 text-violet-700">{r.tag}</span>)}</div></div>
        </div>
      )}
      {(johariOpen.length > 0 || johariHidden.length > 0) && (
        <div className="mb-4 grid sm:grid-cols-2 gap-3">
          <div><div className="text-[11px] font-bold text-emerald-600 mb-1">Open (shared)</div><div className="flex flex-wrap gap-1">{johariOpen.map((a) => <span key={a} className="chip bg-emerald-100 text-emerald-700">{a}</span>)}</div></div>
          <div><div className="text-[11px] font-bold text-violet-600 mb-1">Hidden (private)</div><div className="flex flex-wrap gap-1">{johariHidden.map((a) => <span key={a} className="chip bg-violet-100 text-violet-700">{a}</span>)}</div></div>
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={saveAll} disabled={savePersonality.isPending} className="btn-primary">{savePersonality.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save to my profile</button>
        <button onClick={() => setStage("menu")} className="btn-ghost">Back to assessments</button>
      </div>
    </div>
  );
}

function FinishButtons({ onRetake, onDone }: { onRetake: () => void; onDone: () => void }) {
  return (
    <div className="flex gap-2 mt-3">
      <button onClick={onRetake} className="btn-ghost"><RotateCcw className="w-4 h-4" /> Retake</button>
      <button onClick={onDone} className="btn-primary">Done</button>
    </div>
  );
}

function GameHeader({ title, subtitle, step, onBack }: { title: string; subtitle: string; step: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <button onClick={onBack} className="text-xs font-semibold text-slate-400 hover:text-brand">← All assessments</button>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-bold text-sm text-slate-800 leading-tight">{title}</div>
          <div className="text-[10px] text-slate-400">{subtitle}</div>
        </div>
        <span className="chip bg-slate-100 text-slate-500">{step}</span>
      </div>
    </div>
  );
}
