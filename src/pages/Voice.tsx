import { useState, useEffect } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Mic, Sparkles, Loader2, Save, MessageSquare, Wand2, Plus, X,
} from "lucide-react";
import PersonaStudio from "@/components/PersonaStudio";
import PersonalityGames from "@/components/PersonalityGames";

type Voice = {
  summary: string;
  toneTags: string[];
  signatureVerbs: string[];
  styleNotes: string[];
  dos: string[];
  donts: string[];
  formality: number;
  warmth: number;
  brevity: number;
};

const SUGGESTED_TONES = ["confident", "warm", "direct", "analytical", "energetic", "concise", "collaborative", "visionary", "pragmatic", "polished"];

function Slider({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-1"><span>{low}</span><span className="font-semibold text-slate-700">{label}</span><span>{high}</span></div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[color:var(--brand)]" />
    </div>
  );
}

function TagList({ items, onChange, suggestions }: { items: string[]; onChange: (v: string[]) => void; suggestions?: string[] }) {
  const [val, setVal] = useState("");
  const add = (t: string) => { const x = t.trim(); if (x && !items.includes(x)) onChange([...items, x]); setVal(""); };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((t, i) => (
          <span key={i} className="chip bg-brand-light text-brand">{t}<button onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="w-3 h-3 ml-1" /></button></span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add(val)} className="input flex-1 h-9" placeholder="Add…" />
        <button onClick={() => add(val)} className="btn-ghost h-9 px-3"><Plus className="w-4 h-4" /></button>
      </div>
      {suggestions && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions.filter((s) => !items.includes(s)).map((s) => (
            <button key={s} onClick={() => add(s)} className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Voice() {
  const { user } = useAuth();
  // Gate on the server's effective plan (tier + admin grants).
  const access = trpc.auth.myAccess.useQuery(undefined, { enabled: !!user });
  const isPaid = access.data?.plan.aiOptimizer ?? false;
  const utils = trpc.useUtils();
  const data = trpc.voice.get.useQuery();
  const analyze = trpc.voice.analyze.useMutation();
  const save = trpc.voice.save.useMutation();
  const refine = trpc.voice.refine.useMutation();
  const preview = trpc.voice.preview.useMutation();

  const [sample, setSample] = useState("");
  const [v, setV] = useState<Voice | null>(null);
  const [feedback, setFeedback] = useState("");
  const [previewText, setPreviewText] = useState("");

  useEffect(() => { if (data.data?.voiceJson) setV(data.data.voiceJson as Voice); }, [data.data]);

  const runAnalyze = async () => {
    if (sample.trim().length < 100) return toast.error("Paste a longer writing sample (100+ characters)");
    const res = await analyze.mutateAsync({ samples: [sample] });
    if (!res.success) return toast.error(res.error ?? "Failed");
    setV(res.voice as Voice);
    await utils.voice.get.invalidate();
    toast.success("Got it. Have a look below and tweak anything.");
  };

  const saveVoice = async () => {
    if (!v) return;
    await save.mutateAsync(v);
    await utils.voice.get.invalidate();
    await utils.resume.listProfiles.invalidate();
    toast.success("Saved. Your writing will sound like this from now on.");
  };

  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    const res = await refine.mutateAsync({ feedback });
    if (!res.success) return toast.error(res.error ?? "Failed");
    setV(res.voice as Voice);
    setFeedback("");
    toast.success("Thanks, we've adjusted your voice.");
  };

  const tryIt = async () => {
    const res = await preview.mutateAsync({});
    if (!res.success) return toast.error(res.error ?? "Failed");
    setPreviewText(res.text ?? "");
  };

  if (user && !isPaid) {
    return (
      <div className="max-w-2xl">
        <h1 className="page-title">Voice Studio</h1>
        <p className="page-subtitle mb-6">Show us how you write, and we'll keep that voice in everything.</p>
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-4"><Mic className="w-7 h-7 text-brand" /></div>
          <h2 className="text-lg font-bold text-slate-800">Your voice is your edge</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">Upgrade to read your writing back to you in plain terms, shape the tone and style, and have every document sound like you actually wrote it.</p>
          <Link to="/billing" className="btn-primary mx-auto mt-5"><Sparkles className="w-4 h-4" /> Upgrade to turn it on</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Voice Studio</h1>
      <p className="page-subtitle mb-5">Tell us who you are and show us how you write. Everything then sounds and feels like you.</p>

      {/* Who is X? — self-discovery persona */}
      <PersonaStudio />

      {/* Gamified personality discovery */}
      <PersonalityGames />

      {/* Analyze */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-2"><Wand2 className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Read my writing</h3></div>
        <p className="text-xs text-slate-500 mb-3">Drop in something you wrote. An old cover letter, a bio, a LinkedIn summary, even an email. We'll pick up on your tone, your go-to words, and your style.</p>
        <textarea value={sample} onChange={(e) => setSample(e.target.value)} className="textarea min-h-[120px]" placeholder="Paste something you wrote…" />
        <button onClick={runAnalyze} disabled={analyze.isPending} className="btn-primary mt-3">
          {analyze.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> Analyze my voice</>}
        </button>
      </div>

      {v && (
        <>
          {/* Summary */}
          <div className="card p-5 mb-4" style={{ background: "linear-gradient(135deg,#fff7ed,#fff)" }}>
            <div className="flex items-center gap-2 mb-2"><Mic className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">How your voice sounds</h3></div>
            <p className="text-sm text-slate-700 leading-relaxed">{v.summary}</p>
          </div>

          {/* Pick / blend */}
          <div className="card p-5 mb-4 space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Tone</label>
              <TagList items={v.toneTags} onChange={(x) => setV({ ...v, toneTags: x })} suggestions={SUGGESTED_TONES} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Signature verbs</label>
              <TagList items={v.signatureVerbs} onChange={(x) => setV({ ...v, signatureVerbs: x })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              <Slider label="Formality" low="Casual" high="Formal" value={v.formality} onChange={(n) => setV({ ...v, formality: n })} />
              <Slider label="Warmth" low="Reserved" high="Warm" value={v.warmth} onChange={(n) => setV({ ...v, warmth: n })} />
              <Slider label="Brevity" low="Elaborate" high="Concise" value={v.brevity} onChange={(n) => setV({ ...v, brevity: n })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-emerald-600 mb-1 block">Do</label>
                <ul className="text-sm text-slate-600 space-y-1">{v.dos.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-emerald-500">✓</span>{d}</li>)}</ul>
              </div>
              <div>
                <label className="text-xs font-bold text-rose-500 mb-1 block">Avoid</label>
                <ul className="text-sm text-slate-600 space-y-1">{v.donts.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-rose-400">✕</span>{d}</li>)}</ul>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveVoice} disabled={save.isPending} className="btn-primary">{save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save voice</button>
              <button onClick={tryIt} disabled={preview.isPending} className="btn-ghost">{preview.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Try it</button>
            </div>
            {previewText && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">{previewText}</div>}
          </div>

          {/* Feedback bot */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Tell us what we got wrong</h3></div>
            <p className="text-xs text-slate-500 mb-3">Set us straight in plain words. Things like "I keep it shorter", "I never use buzzwords", or "I like to lead with the result."</p>
            <div className="flex gap-2">
              <input value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFeedback()} className="input flex-1" placeholder="Tell us how you really sound…" />
              <button onClick={sendFeedback} disabled={refine.isPending || !feedback.trim()} className="btn-primary px-4">{refine.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
