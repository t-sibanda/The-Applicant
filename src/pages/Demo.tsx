import { useState } from "react";
import { Link } from "react-router";
import {
  Sparkles, Mic, Wand2, Briefcase, FileText, ArrowRight, ArrowLeft,
  Check, Star, DollarSign, Bot, Play,
} from "lucide-react";

/**
 * Self-contained, no-login product demo/walkthrough with SIMULATED results.
 * Use it to present The Applicant to any audience — especially Voice Studio.
 * All content here is illustrative sample data (clearly labeled), not real AI output.
 */

const SAMPLE_VOICE = {
  summary:
    "You write with confident, results-driven energy. Sentences are short and active, you lead with impact and quantify outcomes, and you avoid buzzwords in favor of concrete detail. Your tone is professional but warm — approachable, never stiff.",
  toneTags: ["confident", "direct", "results-driven", "warm", "concise"],
  signatureVerbs: ["led", "built", "scaled", "delivered", "streamlined", "drove"],
  formality: 62,
  warmth: 68,
  brevity: 78,
  dos: ["Lead with measurable impact", "Use active voice", "Keep sentences tight"],
  donts: ["Corporate buzzwords", "Passive phrasing", "Vague adjectives"],
};

const SAMPLE_PREVIEW =
  "Mechanical engineer who builds and scales high-performance cooling systems. I led the design of a modular data-center cooling skid that cut installation time 35% and delivered 18% energy savings. I move fast, quantify everything, and bring teams with me.";

const SAMPLE_JOBS = [
  { title: "Senior Mechanical Engineer — Data Centers", company: "Atlas Infrastructure", match: 94, quality: 88, salary: "USD 140k–170k", posted: "1 day ago" },
  { title: "Cooling Systems Design Lead", company: "Nimbus Cloud", match: 89, quality: 82, salary: "USD 130k–160k", posted: "3 days ago" },
  { title: "HVAC / Thermal Engineer", company: "GreenGrid", match: 76, quality: null, salary: null, posted: "6 days ago" },
];

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "voice", label: "Voice Studio" },
  { id: "jobs", label: "Smart Jobs" },
  { id: "optimize", label: "Tailor & ATS" },
  { id: "apply", label: "Safe Apply" },
  { id: "done", label: "Recap" },
];

export default function Demo() {
  const [step, setStep] = useState(0);
  const [analyzed, setAnalyzed] = useState(false);
  const [formality, setFormality] = useState(SAMPLE_VOICE.formality);
  const [warmth, setWarmth] = useState(SAMPLE_VOICE.warmth);
  const [brevity, setBrevity] = useState(SAMPLE_VOICE.brevity);
  const [showPreview, setShowPreview] = useState(false);
  const [atsRun, setAtsRun] = useState(false);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Product Demo</h1>
        <span className="chip bg-amber-100 text-amber-700">Simulated — sample data</span>
      </div>
      <p className="page-subtitle mb-5">A guided walkthrough of The Applicant. Sample results illustrate the experience.</p>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {STEPS.map((st, i) => (
          <button key={st.id} onClick={() => setStep(i)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${i === step ? "bg-brand text-white" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400"}`}>
            {i < step && <Check className="w-3 h-3 inline mr-1" />}{st.label}
          </button>
        ))}
      </div>

      <div className="card p-6 min-h-[380px]">
        {step === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8 text-brand" /></div>
            <h2 className="text-xl font-bold text-slate-800 font-serif-display">Meet The Applicant</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">The AI job-hunt platform that applies in your voice. In this quick tour you'll teach the AI your voice, find matched jobs, tailor an application, and apply — safely.</p>
            <button onClick={next} className="btn-primary mx-auto mt-6"><Play className="w-4 h-4" /> Start the tour</button>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-1"><Mic className="w-5 h-5 text-brand" /><h2 className="text-lg font-bold text-slate-800">Voice Studio</h2></div>
            <p className="text-sm text-slate-500 mb-4">The flagship: the AI learns your writing voice — and lets you see and tune it.</p>
            {!analyzed ? (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500 mb-2">Sample writing pasted:</p>
                <p className="text-sm text-slate-600 italic">"I led a team that rebuilt our cooling platform from scratch — cut costs 20%, shipped in half the time…"</p>
                <button onClick={() => setAnalyzed(true)} className="btn-primary mt-3"><Wand2 className="w-4 h-4" /> Analyze my voice</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#fff7ed,#fff)" }}>
                  <div className="text-xs font-bold text-brand mb-1">How your voice sounds</div>
                  <p className="text-sm text-slate-700">{SAMPLE_VOICE.summary}</p>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">Tone</div>
                  <div className="flex flex-wrap gap-1.5">{SAMPLE_VOICE.toneTags.map((t) => <span key={t} className="chip bg-brand-light text-brand">{t}</span>)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">Signature verbs</div>
                  <div className="flex flex-wrap gap-1.5">{SAMPLE_VOICE.signatureVerbs.map((t) => <span key={t} className="chip bg-slate-100 text-slate-600">{t}</span>)}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[["Formality", formality, setFormality], ["Warmth", warmth, setWarmth], ["Brevity", brevity, setBrevity]].map(([lbl, val, set]: any) => (
                    <div key={lbl}>
                      <div className="text-[11px] text-slate-500 mb-1 flex justify-between"><span>{lbl}</span><span className="font-semibold">{val}</span></div>
                      <input type="range" min={0} max={100} value={val} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[color:var(--brand)]" />
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowPreview(true)} className="btn-ghost"><Sparkles className="w-4 h-4" /> Try it — write in my voice</button>
                {showPreview && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{SAMPLE_PREVIEW}</div>}
                <p className="text-xs text-slate-400">A feedback bot lets you correct anything the AI missed ("I'm more concise", "I never use buzzwords") — and it updates instantly.</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 mb-1"><Briefcase className="w-5 h-5 text-brand" /><h2 className="text-lg font-bold text-slate-800">Smart job search</h2></div>
            <p className="text-sm text-slate-500 mb-4">Multiple compliant sources, ranked by relevance and quality — filter by salary, recency, and more.</p>
            <div className="space-y-2">
              {SAMPLE_JOBS.map((j) => (
                <div key={j.title} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800 flex-1">{j.title}</span>
                    <span className="chip bg-blue-100 text-blue-700">{j.match}% match</span>
                    {j.quality ? <span className="chip bg-emerald-100 text-emerald-700">★ {j.quality}</span> : <span className="chip bg-slate-100 text-slate-400">Unrated</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{j.company} · {j.posted}</span>
                    {j.salary ? <span className="chip bg-amber-100 text-amber-700"><DollarSign className="w-3 h-3" />{j.salary}</span> : <span className="chip bg-slate-100 text-slate-400">Salary not listed</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center gap-2 mb-1"><FileText className="w-5 h-5 text-brand" /><h2 className="text-lg font-bold text-slate-800">Tailor & ATS score</h2></div>
            <p className="text-sm text-slate-500 mb-4">One click tailors your resume to the job — in your voice — then scores it against the ATS.</p>
            {!atsRun ? (
              <button onClick={() => setAtsRun(true)} className="btn-primary"><Bot className="w-4 h-4" /> Tailor & score for "Senior Mechanical Engineer"</button>
            ) : (
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3"><span className="font-bold text-sm text-slate-800">ATS match</span><span className="text-2xl font-extrabold text-brand">91%</span></div>
                {[["Keyword coverage", 88], ["Format", 100], ["Seniority", 90], ["Semantic fit", 86]].map(([k, v]: any) => (
                  <div key={k} className="mb-1.5">
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">{k}</span><span className="text-slate-400">{v}%</span></div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${v}%` }} /></div>
                  </div>
                ))}
                <div className="text-xs font-bold text-rose-700 mt-3 mb-1">Suggested keywords to add</div>
                <div className="flex flex-wrap gap-1">{["ASHRAE 90.1", "NFPA 70", "liquid cooling"].map((k) => <span key={k} className="chip bg-white text-rose-700">{k}</span>)}</div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex items-center gap-2 mb-1"><Check className="w-5 h-5 text-emerald-500" /><h2 className="text-lg font-bold text-slate-800">Apply — the safe way</h2></div>
            <p className="text-sm text-slate-500 mb-4">AI prepares your materials; you review and submit. No blind automation, no ban risk.</p>
            <div className="space-y-2">
              {[["Assisted apply", "AI drafts a tailored resume + cover letter per job — you approve."], ["Auto-apply (guided)", "Bulk-prepare review-ready drafts for your top matches."], ["Autofill extension", "Fills forms on click; you submit. Never headless."]].map((c) => (
                <div key={c[0]} className="rounded-xl bg-slate-50 p-3 flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <div><div className="font-semibold text-sm text-slate-800">{c[0]}</div><div className="text-xs text-slate-500">{c[1]}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8 text-brand" /></div>
            <h2 className="text-xl font-bold text-slate-800 font-serif-display">That's The Applicant.</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">Voice-personalized, quality-first, all-in-one, and safe — the antidote to generic, ban-risky job-hunt bots.</p>
            <div className="flex gap-2 justify-center mt-6 flex-wrap">
              <Link to="/voice" className="btn-primary"><Mic className="w-4 h-4" /> Open Voice Studio</Link>
              <Link to="/jobs" className="btn-ghost"><Briefcase className="w-4 h-4" /> Find jobs</Link>
              <button onClick={() => { setStep(0); setAnalyzed(false); setShowPreview(false); setAtsRun(false); }} className="btn-ghost">Restart demo</button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex justify-between mt-4">
        <button onClick={prev} disabled={step === 0} className="btn-ghost disabled:opacity-40"><ArrowLeft className="w-4 h-4" /> Back</button>
        {step < STEPS.length - 1 && <button onClick={next} className="btn-primary">Next <ArrowRight className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}
