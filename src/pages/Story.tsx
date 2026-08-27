import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import {
  Sparkles, Mic, Briefcase, FileText, Check, Star, DollarSign, Play, Pause, RotateCcw,
} from "lucide-react";

/**
 * An auto-playing, video-style story of one candidate's journey through the app,
 * start to finish, in about 60 seconds. Screen-record this page to produce an MP4,
 * or just play it live. All content is illustrative sample data.
 *
 * Meet Maya. She's a mechanical engineer looking for her next role.
 */

type Scene = { seconds: number; render: (t: number) => React.ReactNode };

const GOLD = "#F5B800";

function Caption({ children }: { children: React.ReactNode }) {
  return <div className="absolute bottom-8 left-0 right-0 text-center px-10"><span className="inline-block bg-black/60 text-white text-lg px-4 py-2 rounded-xl">{children}</span></div>;
}

export default function Story() {
  const scenes: Scene[] = [
    // 0 — intro
    { seconds: 6, render: () => (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-3xl bg-[color:var(--gold)] flex items-center justify-center mb-5"><Sparkles className="w-10 h-10 text-slate-900" /></div>
        <h1 className="hero-serif text-4xl text-white">Meet Maya.</h1>
        <p className="text-white/60 mt-3 text-lg max-w-md">A mechanical engineer, ready for her next role and tired of sending resumes into the void.</p>
        <Caption>Every job hunt starts the same way. This one goes differently.</Caption>
      </div>
    )},
    // 1 — voice
    { seconds: 9, render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <div className="flex items-center gap-2 text-[color:var(--gold)] text-sm font-bold uppercase tracking-widest mb-2"><Mic className="w-4 h-4" /> Voice Studio</div>
        <h2 className="hero-serif text-3xl text-white mb-4">First, she teaches it her voice.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="text-xs font-bold text-brand mb-1">How your voice sounds</div>
          <p className="text-sm text-slate-700">{t > 3 ? "You write with confident, results-driven energy. Short, active sentences. You lead with impact and skip the buzzwords." : "Analyzing your writing…"}</p>
          {t > 5 && <div className="flex flex-wrap gap-1.5 mt-3">{["confident", "direct", "results-driven", "warm"].map((x) => <span key={x} className="chip bg-brand-light text-brand">{x}</span>)}</div>}
        </div>
        <Caption>No more generic AI. It writes the way Maya actually writes.</Caption>
      </div>
    )},
    // 2 — jobs
    { seconds: 9, render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <div className="flex items-center gap-2 text-[color:var(--gold)] text-sm font-bold uppercase tracking-widest mb-2"><Briefcase className="w-4 h-4" /> Smart search</div>
        <h2 className="hero-serif text-3xl text-white mb-4">Then it finds the right jobs.</h2>
        <div className="space-y-2 max-w-xl">
          {[["Senior Mechanical Engineer, Data Centers", 94, "140k–170k"], ["Cooling Systems Design Lead", 89, "130k–160k"]].slice(0, t > 4 ? 2 : 1).map(([title, m, sal]: any) => (
            <div key={title} className="bg-white rounded-xl p-3 flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800 flex-1">{title}</span>
              <span className="chip bg-blue-100 text-blue-700">{m}% match</span>
              <span className="chip bg-amber-100 text-amber-700"><DollarSign className="w-3 h-3" />{sal}</span>
            </div>
          ))}
        </div>
        <Caption>Ranked by real relevance and pay. No noise, no off-target spam.</Caption>
      </div>
    )},
    // 3 — tailor
    { seconds: 9, render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <div className="flex items-center gap-2 text-[color:var(--gold)] text-sm font-bold uppercase tracking-widest mb-2"><FileText className="w-4 h-4" /> Tailor & score</div>
        <h2 className="hero-serif text-3xl text-white mb-4">One click tailors her resume.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="flex items-center justify-between mb-3"><span className="font-bold text-sm text-slate-800">ATS match</span><span className="text-3xl font-extrabold text-brand">{Math.min(91, Math.round(t * 12))}%</span></div>
          {[["Keywords", 88], ["Format", 100], ["Fit", 86]].map(([k, v]: any) => (
            <div key={k} className="mb-1.5"><div className="flex justify-between text-[11px] text-slate-500"><span>{k}</span><span>{v}%</span></div><div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${t > 3 ? v : 0}%` }} /></div></div>
          ))}
        </div>
        <Caption>Written in her voice, tuned to pass the ATS.</Caption>
      </div>
    )},
    // 4 — apply
    { seconds: 8, render: () => (
      <div className="h-full flex flex-col justify-center px-14">
        <div className="flex items-center gap-2 text-[color:var(--gold)] text-sm font-bold uppercase tracking-widest mb-2"><Check className="w-4 h-4" /> Apply, safely</div>
        <h2 className="hero-serif text-3xl text-white mb-4">She reviews, then applies.</h2>
        <div className="space-y-2 max-w-xl">
          {["Draft ready in Maya's voice", "She tweaks one line", "Applied, with confidence"].map((x, i) => (
            <div key={x} className="bg-white rounded-xl p-3 flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">{i + 1}</div><span className="text-sm text-slate-700">{x}</span></div>
          ))}
        </div>
        <Caption>She stays in control. No risky bots applying behind her back.</Caption>
      </div>
    )},
    // 5 — close
    { seconds: 6, render: () => (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <Star className="w-12 h-12 text-[color:var(--gold)] mb-4" />
        <h1 className="hero-serif text-4xl text-white">Maya sounds like Maya.</h1>
        <p className="text-white/60 mt-3 text-lg max-w-md">Better matches, stronger applications, and a profile that markets her, in her own words.</p>
        <p className="text-[color:var(--gold)] font-bold mt-5 text-xl">The Applicant</p>
      </div>
    )},
  ];

  const total = scenes.reduce((n, s) => n + s.seconds, 0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setElapsed((e) => {
        const n = e + dt;
        return n >= total ? total : n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, total]);

  // Which scene + time within it.
  let acc = 0, idx = 0, within = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (elapsed < acc + scenes[i].seconds || i === scenes.length - 1) { idx = i; within = elapsed - acc; break; }
    acc += scenes[i].seconds;
  }
  const done = elapsed >= total;

  return (
    <div className="min-h-screen relative z-10 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/80 font-semibold">Maya's story · ~1 min</span>
          <span className="chip bg-amber-100 text-amber-700">Simulated</span>
        </div>

        {/* Video frame */}
        <div className="hero-dark rounded-3xl relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
          <div key={idx} className="absolute inset-0 animate-fade-in">{scenes[idx].render(within)}</div>
          {done && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <button onClick={() => { setElapsed(0); setPlaying(true); }} className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[color:var(--gold)] text-slate-900 font-bold"><RotateCcw className="w-4 h-4" /> Replay</button>
            </div>
          )}
        </div>

        {/* Progress + controls */}
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[color:var(--gold)]" style={{ width: `${(elapsed / total) * 100}%` }} /></div>
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 text-white text-sm font-semibold hover:bg-white/20">
              {playing ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
            </button>
            <button onClick={() => { setElapsed(0); setPlaying(true); }} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 text-white text-sm font-semibold hover:bg-white/20"><RotateCcw className="w-4 h-4" /> Restart</button>
            <span className="text-white/40 text-sm ml-auto">{Math.floor(elapsed)}s / {total}s</span>
            <Link to="/demo" className="text-[color:var(--gold)] text-sm font-semibold">Try the interactive demo →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
