import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import {
  Sparkles, Mic, Briefcase, FileText, Check, Star, DollarSign, Play, Pause,
  RotateCcw, ArrowLeft, User, Bot, BarChart3, Send, GraduationCap, Trophy,
  ScanSearch, Building2,
} from "lucide-react";

/**
 * An auto-playing, video-style story of one candidate's full journey through
 * the app, page by page, start to finish, in about 90 seconds. Screen-record
 * this page to produce an MP4, or just play it live.
 *
 * Meet Maya. She's a mechanical engineer looking for her next role. The story
 * walks the same path a new user takes: set up a profile, teach it your voice,
 * search + read company hiring, scan a role, tailor + score, apply and track,
 * then grow, and land interviews and offers.
 *
 * All content is illustrative sample data.
 */

type Scene = { seconds: number; label: string; render: (t: number) => React.ReactNode };

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-8 left-0 right-0 text-center px-10">
      <span className="inline-block bg-black/60 text-white text-base md:text-lg px-4 py-2 rounded-xl">{children}</span>
    </div>
  );
}

function Tag({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[color:var(--gold)] text-sm font-bold uppercase tracking-widest mb-2">
      <Icon className="w-4 h-4" /> {children}
    </div>
  );
}

export default function Story() {
  const scenes: Scene[] = [
    // 0 — intro
    { seconds: 6, label: "Meet Maya", render: () => (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 rounded-3xl bg-[color:var(--gold)] flex items-center justify-center mb-5"><Sparkles className="w-10 h-10 text-slate-900" /></div>
        <h1 className="hero-serif text-4xl text-white">Meet Maya.</h1>
        <p className="text-white/60 mt-3 text-lg max-w-md">A mechanical engineer, ready for her next role and tired of sending resumes into the void.</p>
        <Caption>Every job hunt starts the same way. This one goes differently.</Caption>
      </div>
    )},

    // 1 — profile & portfolio
    { seconds: 9, label: "Profile", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={User}>Profile &amp; Portfolio</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">She sets up who she is.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="font-semibold text-sm text-slate-800">Maya Chen · Mechanical Engineer</div>
          <div className="text-xs text-slate-500 mt-0.5">Target: Data-center cooling · Remote / CA</div>
          {t > 3 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["thermal design", "team lead", "energy efficiency", "CAD"].map((x) => <span key={x} className="chip bg-brand-light text-brand">{x}</span>)}
            </div>
          )}
          {t > 5 && <div className="text-[11px] text-emerald-600 font-semibold mt-3">Portfolio page ready to share ✓</div>}
        </div>
        <Caption>One profile: her target, her skills, and a portfolio to share.</Caption>
      </div>
    )},

    // 2 — voice
    { seconds: 9, label: "Voice", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={Mic}>Voice Studio</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">Then she teaches it her voice.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="text-xs font-bold text-brand mb-1">How your voice sounds</div>
          <p className="text-sm text-slate-700">{t > 3 ? "You write with confident, results-driven energy. Short, active sentences. You lead with impact and skip the buzzwords." : "Reading your writing…"}</p>
          {t > 5 && <div className="flex flex-wrap gap-1.5 mt-3">{["confident", "direct", "results-driven", "warm"].map((x) => <span key={x} className="chip bg-brand-light text-brand">{x}</span>)}</div>}
        </div>
        <Caption>No more generic AI. Everything it writes sounds like Maya.</Caption>
      </div>
    )},

    // 3 — jobs search
    { seconds: 9, label: "Search", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={Briefcase}>Smart search</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">It finds the right jobs.</h2>
        <div className="space-y-2 max-w-xl">
          {[["Senior Mechanical Engineer, Data Centers", 94, "140k–170k"], ["Cooling Systems Design Lead", 89, "130k–160k"]].slice(0, t > 4 ? 2 : 1).map(([title, m, sal]: any) => (
            <div key={title} className="bg-white rounded-xl p-3 flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800 flex-1">{title}</span>
              <span className="chip bg-blue-100 text-blue-700">{m}% match</span>
              <span className="chip bg-amber-100 text-amber-700"><DollarSign className="w-3 h-3" />{sal}</span>
            </div>
          ))}
        </div>
        <Caption>Pulled from many compliant sources, ranked by real relevance and pay.</Caption>
      </div>
    )},

    // 4 — company insights
    { seconds: 9, label: "Insights", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={BarChart3}>Company hiring insights</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">She sees who's really hiring.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-brand" /> Atlas Infrastructure · 42 open roles</div>
          {[["Engineering", 18], ["Operations", 9], ["Facilities", 5]].map(([d, n]: any, i) => (
            <div key={d} className="flex items-center gap-2 mb-1" style={{ opacity: t > i + 1 ? 1 : 0.2 }}>
              <div className="w-28 text-xs text-slate-600">{d}</div>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${(n / 18) * 100}%` }} /></div>
              <div className="w-6 text-right text-[11px] text-slate-400">{n}</div>
            </div>
          ))}
          {t > 5 && <div className="text-[11px] text-violet-600 font-semibold mt-2">3 niche roles, 1 posting each — less contested</div>}
        </div>
        <Caption>Departments hiring, roles in volume, and the rare openings worth targeting.</Caption>
      </div>
    )},

    // 5 — quick scan
    { seconds: 8, label: "Scan", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={ScanSearch}>Quick scan</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">Before she commits, a quick read.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="chip bg-emerald-100 text-emerald-700 text-sm font-bold px-3 py-1">{Math.min(88, Math.round(t * 14))}% match</span>
            <span className="text-sm text-slate-600">Strong match. Worth applying.</span>
          </div>
          {t > 4 && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div><div className="text-[11px] font-bold text-emerald-600">You cover</div><div className="text-xs text-slate-500">thermal, CAD, team lead</div></div>
              <div><div className="text-[11px] font-bold text-rose-500">Worth adding</div><div className="text-xs text-slate-500">ASHRAE 90.1</div></div>
            </div>
          )}
        </div>
        <Caption>A match rating and a plain verdict, so she never applies blind.</Caption>
      </div>
    )},

    // 6 — tailor + ATS
    { seconds: 9, label: "Tailor", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={FileText}>Tailor &amp; score</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">One click tailors her resume.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="flex items-center justify-between mb-3"><span className="font-bold text-sm text-slate-800">ATS match</span><span className="text-3xl font-extrabold text-brand">{Math.min(91, Math.round(t * 12))}%</span></div>
          {[["Keywords", 88], ["Format", 100], ["Fit", 86]].map(([k, v]: any) => (
            <div key={k} className="mb-1.5"><div className="flex justify-between text-[11px] text-slate-500"><span>{k}</span><span>{v}%</span></div><div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${t > 3 ? v : 0}%` }} /></div></div>
          ))}
        </div>
        <Caption>Written in her voice with the AI Optimizer, tuned to pass the ATS.</Caption>
      </div>
    )},

    // 7 — apply safely + track
    { seconds: 9, label: "Apply", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={Send}>Apply &amp; track</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">She reviews, applies, and tracks it.</h2>
        <div className="space-y-2 max-w-xl">
          {[["Draft saved for this job", "check"], ["She tweaks one line, then applies", "check"], ["Logged in the pipeline: Applied", "pipe"]].slice(0, Math.min(3, Math.floor(t / 2) + 1)).map(([x, kind], i) => (
            <div key={i} className="bg-white rounded-xl p-3 flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">{i + 1}</div>
              <span className="text-sm text-slate-700 flex-1">{x}</span>
              {kind === "pipe" && <span className="chip bg-blue-100 text-blue-700">Applied</span>}
            </div>
          ))}
        </div>
        <Caption>Every document is saved per job, so she can revisit and reuse it.</Caption>
      </div>
    )},

    // 8 — grow
    { seconds: 8, label: "Grow", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={GraduationCap}>Growth</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">Between applications, she levels up.</h2>
        <div className="bg-white rounded-2xl p-5 max-w-xl">
          <div className="text-xs font-bold text-slate-800 mb-2">Next 90 days</div>
          <ul className="space-y-1.5">
            {["Add ASHRAE certification", "Publish a cooling case study", "2 informational chats"].slice(0, Math.min(3, Math.floor(t / 2) + 1)).map((x) => (
              <li key={x} className="flex gap-2 text-sm text-slate-600"><span className="text-brand">▸</span>{x}</li>
            ))}
          </ul>
        </div>
        <Caption>A career plan and saved learnings that keep sharpening her profile.</Caption>
      </div>
    )},

    // 9 — outcomes
    { seconds: 8, label: "Results", render: (t) => (
      <div className="h-full flex flex-col justify-center px-14">
        <Tag icon={Trophy}>The payoff</Tag>
        <h2 className="hero-serif text-3xl text-white mb-4">Fewer, better applications. Real replies.</h2>
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          {[["Interviews", "3"], ["Final rounds", "2"], ["Offers", "1"]].map(([k, v], i) => (
            <div key={k} className="bg-white rounded-xl p-4 text-center" style={{ opacity: t > i + 1 ? 1 : 0.25 }}>
              <div className="text-2xl font-extrabold text-brand">{v}</div>
              <div className="text-[11px] text-slate-500">{k}</div>
            </div>
          ))}
        </div>
        <Caption>Quality over spray-and-pray. Interviews and an offer, faster.</Caption>
      </div>
    )},

    // 10 — close
    { seconds: 6, label: "Close", render: () => (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
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

  // Jump to a specific scene by clicking its chapter marker.
  const jumpTo = (i: number) => {
    let s = 0;
    for (let k = 0; k < i; k++) s += scenes[k].seconds;
    setElapsed(s);
    setPlaying(true);
  };

  return (
    <div className="min-h-screen relative z-10 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-semibold"><ArrowLeft className="w-4 h-4" /> Back to app</Link>
            <span className="text-white/80 font-semibold">Maya's full journey · ~1.5 min</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/demo" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 text-white text-sm font-semibold hover:bg-white/20"><Play className="w-3.5 h-3.5" /> Interactive demo</Link>
            <span className="chip bg-amber-100 text-amber-700">Simulated</span>
          </div>
        </div>

        {/* Video frame */}
        <div className="hero-dark rounded-3xl relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
          <div key={idx} className="absolute inset-0 animate-fade-in">{scenes[idx].render(within)}</div>
          {done && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-4">
              <button onClick={() => { setElapsed(0); setPlaying(true); }} className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[color:var(--gold)] text-slate-900 font-bold"><RotateCcw className="w-4 h-4" /> Replay</button>
              <Link to="/login" className="text-white/80 text-sm font-semibold hover:text-white">Start your own journey →</Link>
            </div>
          )}
        </div>

        {/* Progress + controls */}
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[color:var(--gold)] transition-[width] duration-150" style={{ width: `${(elapsed / total) * 100}%` }} /></div>

          {/* Chapter markers */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {scenes.map((s, i) => (
              <button
                key={s.label}
                onClick={() => jumpTo(i)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${i === idx ? "bg-[color:var(--gold)] text-slate-900" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

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
