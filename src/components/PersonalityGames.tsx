import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Gamepad2, Loader2, Check, ArrowRight, RotateCcw, Save, Sparkles,
} from "lucide-react";
import {
  DISC_QUESTIONS, DISC_LABEL, scoreDisc, type Disc,
  BIG_FIVE_STATEMENTS, BIG_FIVE_LABEL, scoreBigFive,
  WORK_VALUES, JOHARI_ADJECTIVES,
} from "@/lib/personality";

type Stage = "menu" | "disc" | "bigfive" | "values" | "johari" | "done";

function Bar({ label, pct, color = "var(--brand)" }: { label: string; pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-40 shrink-0 text-xs text-slate-600 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-9 text-right text-[11px] text-slate-400">{pct}%</div>
    </div>
  );
}

export default function PersonalityGames() {
  const utils = trpc.useUtils();
  const personaQuery = trpc.voice.getPersona.useQuery();
  const savePersonality = trpc.voice.savePersonality.useMutation();

  const saved = personaQuery.data?.personality;
  const [stage, setStage] = useState<Stage>("menu");

  // DISC
  const [discIdx, setDiscIdx] = useState(0);
  const [discAns, setDiscAns] = useState<Disc[]>([]);
  // Big Five
  const [bfAns, setBfAns] = useState<Record<number, number>>({});
  // Values
  const [valuePicks, setValuePicks] = useState<string[]>([]);
  // Johari
  const [johariOpen, setJohariOpen] = useState<string[]>([]); // known to self + shown to others
  const [johariHidden, setJohariHidden] = useState<string[]>([]); // known to self, kept private

  // Locally-computed results (persisted on save).
  const disc = discAns.length === DISC_QUESTIONS.length ? scoreDisc(discAns) : saved?.disc;
  const bigFive = Object.keys(bfAns).length === BIG_FIVE_STATEMENTS.length ? scoreBigFive(bfAns) : saved?.bigFive;

  const toggleValue = (v: string) => {
    setValuePicks((cur) => cur.includes(v) ? cur.filter((x) => x !== v) : cur.length < 5 ? [...cur, v] : cur);
  };
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
    if (bigFive) payload.bigFive = bigFive;
    if (valuePicks.length) payload.values = { scores: Object.fromEntries(valuePicks.map((v, i) => [v, valuePicks.length - i])), top: valuePicks };
    if (johariOpen.length || johariHidden.length) payload.johari = { open: johariOpen, hidden: johariHidden, blind: [] };
    const bits: string[] = [];
    if (disc) bits.push(`DISC: ${disc.primary}`);
    if (valuePicks.length) bits.push(`values ${valuePicks.slice(0, 3).join(", ")}`);
    payload.summary = bits.join("; ");
    if (Object.keys(payload).length <= 1) return toast.error("Play at least one game first");
    await savePersonality.mutateAsync(payload);
    await utils.voice.getPersona.invalidate();
    toast.success("Saved. Your personality now informs your voice and growth plan.");
    setStage("done");
  };

  // ── Menu ──
  if (stage === "menu") {
    return (
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Personality discovery</h3>
          <span className="text-xs text-slate-400">quick, playful, self-insight</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Four short games map how you work and who you are. For self-insight, not a clinical test. Results sharpen your voice and your growth plan.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { id: "disc", t: "DISC style", d: "How you work and lead", done: !!saved?.disc },
            { id: "bigfive", t: "Big Five", d: "Your core traits", done: !!saved?.bigFive },
            { id: "values", t: "Work values", d: "What matters most", done: !!saved?.values },
            { id: "johari", t: "Johari Window", d: "Seen vs unseen self", done: !!saved?.johari },
          ].map((g) => (
            <button key={g.id} onClick={() => setStage(g.id as Stage)} className="tile bg-slate-50 text-left flex items-start gap-2">
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">{g.t}{g.done && <Check className="w-3.5 h-3.5 text-emerald-500" />}</div>
                <div className="text-xs text-slate-500">{g.d}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
        {saved && (
          <div className="rounded-xl bg-slate-50 p-3 mt-3 text-xs text-slate-600">
            <span className="font-semibold">Saved profile:</span> {saved.summary || "results recorded"}.
            <button onClick={() => setStage("done")} className="text-brand font-semibold ml-2">View</button>
          </div>
        )}
      </div>
    );
  }

  // ── DISC game ──
  if (stage === "disc") {
    const q = DISC_QUESTIONS[discIdx];
    const finished = discAns.length === DISC_QUESTIONS.length;
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="DISC style" step={`${Math.min(discIdx + 1, DISC_QUESTIONS.length)}/${DISC_QUESTIONS.length}`} onBack={() => setStage("menu")} />
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
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setDiscAns([]); setDiscIdx(0); }} className="btn-ghost"><RotateCcw className="w-4 h-4" /> Retake</button>
              <button onClick={() => setStage("menu")} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Big Five game ──
  if (stage === "bigfive") {
    const finished = Object.keys(bfAns).length === BIG_FIVE_STATEMENTS.length;
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Big Five" step={`${Object.keys(bfAns).length}/${BIG_FIVE_STATEMENTS.length}`} onBack={() => setStage("menu")} />
        {!finished ? (
          <div className="space-y-3">
            {BIG_FIVE_STATEMENTS.map((s, i) => (
              <div key={i}>
                <p className="text-sm text-slate-700 mb-1">{s.text}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setBfAns((a) => ({ ...a, [i]: v }))}
                      className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${bfAns[i] === v ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between text-[10px] text-slate-400"><span>Disagree</span><span>Agree</span></div>
          </div>
        ) : bigFive && (
          <div>
            <Bar label={BIG_FIVE_LABEL.O} pct={bigFive.O} />
            <Bar label={BIG_FIVE_LABEL.C} pct={bigFive.C} />
            <Bar label={BIG_FIVE_LABEL.E} pct={bigFive.E} />
            <Bar label={BIG_FIVE_LABEL.A} pct={bigFive.A} />
            <Bar label={BIG_FIVE_LABEL.N} pct={bigFive.N} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setBfAns({})} className="btn-ghost"><RotateCcw className="w-4 h-4" /> Retake</button>
              <button onClick={() => setStage("menu")} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Values game ──
  if (stage === "values") {
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Work values" step={`${valuePicks.length}/5`} onBack={() => setStage("menu")} />
        <p className="text-xs text-slate-500 mb-3">Pick up to 5, in order of what matters most. The order is your ranking.</p>
        <div className="flex flex-wrap gap-2">
          {WORK_VALUES.map((v) => {
            const rank = valuePicks.indexOf(v);
            return (
              <button key={v} onClick={() => toggleValue(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${rank >= 0 ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {rank >= 0 && <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[10px]">{rank + 1}</span>}
                {v}
              </button>
            );
          })}
        </div>
        <button onClick={() => setStage("menu")} className="btn-primary mt-4">Done</button>
      </div>
    );
  }

  // ── Johari game ──
  if (stage === "johari") {
    return (
      <div className="card p-5 mb-4">
        <GameHeader title="Johari Window" step={`${johariOpen.length + johariHidden.length}`} onBack={() => setStage("menu")} />
        <p className="text-xs text-slate-500 mb-3">
          Pick words that describe you. Mark each as <span className="font-semibold text-emerald-600">Open</span> (others see it too) or <span className="font-semibold text-violet-600">Hidden</span> (true, but you keep it private). What peers add later becomes your "blind" quadrant.
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
      <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Your personality snapshot</h3></div>
      {disc && (
        <div className="mb-3">
          <div className="text-[11px] font-bold text-slate-500 mb-1">DISC</div>
          {(["D", "I", "S", "C"] as Disc[]).map((k) => <Bar key={k} label={DISC_LABEL[k]} pct={disc[k]} />)}
        </div>
      )}
      {bigFive && (
        <div className="mb-3">
          <div className="text-[11px] font-bold text-slate-500 mb-1">Big Five</div>
          {(["O", "C", "E", "A", "N"] as const).map((k) => <Bar key={k} label={BIG_FIVE_LABEL[k]} pct={bigFive[k]} color="#7c3aed" />)}
        </div>
      )}
      {valuePicks.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-bold text-slate-500 mb-1">Top values</div>
          <div className="flex flex-wrap gap-1.5">{valuePicks.map((v, i) => <span key={v} className="chip bg-brand-light text-brand">{i + 1}. {v}</span>)}</div>
        </div>
      )}
      {(johariOpen.length > 0 || johariHidden.length > 0) && (
        <div className="mb-3 grid sm:grid-cols-2 gap-3">
          <div><div className="text-[11px] font-bold text-emerald-600 mb-1">Open (shared)</div><div className="flex flex-wrap gap-1">{johariOpen.map((a) => <span key={a} className="chip bg-emerald-100 text-emerald-700">{a}</span>)}</div></div>
          <div><div className="text-[11px] font-bold text-violet-600 mb-1">Hidden (private)</div><div className="flex flex-wrap gap-1">{johariHidden.map((a) => <span key={a} className="chip bg-violet-100 text-violet-700">{a}</span>)}</div></div>
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={saveAll} disabled={savePersonality.isPending} className="btn-primary">{savePersonality.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save to my profile</button>
        <button onClick={() => setStage("menu")} className="btn-ghost">Back to games</button>
      </div>
    </div>
  );
}

function GameHeader({ title, step, onBack }: { title: string; step: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <button onClick={onBack} className="text-xs font-semibold text-slate-400 hover:text-brand">← Games</button>
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm text-slate-800">{title}</span>
        <span className="chip bg-slate-100 text-slate-500">{step}</span>
      </div>
    </div>
  );
}
