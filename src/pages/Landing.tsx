import { Link } from "react-router";
import {
  Sparkles, Mic, Bot, Briefcase, LayoutTemplate, GraduationCap, BookOpen,
  Check, Shield, ArrowRight, Building2, Play,
} from "lucide-react";

/**
 * Public marketing landing + pricing page (no login required).
 * Prices are defined in one place (PRICING) — update to match your Stripe prices.
 */

const PRICING = {
  free: { price: "$0", period: "forever" },
  basic: { price: "$12", period: "/mo" },
  pro: { price: "$29", period: "/mo" },
  org: { price: "Custom", period: "contact us" },
};

const FEATURES = [
  { icon: Mic, title: "Voice Studio", desc: "The AI learns, summarizes, and tunes your writing voice — so every document sounds like you." },
  { icon: Bot, title: "AI Optimizer", desc: "Tailor resumes, generate cover letters, score ATS fit, and analyze skill gaps." },
  { icon: Briefcase, title: "Smart Job Search", desc: "Multiple compliant sources, relevance ranking, salary and recency filters." },
  { icon: LayoutTemplate, title: "Portfolio Builder", desc: "An interactive, shareable page that markets you to interviewers." },
  { icon: GraduationCap, title: "Career Builder", desc: "Simulate your path and find the certifications that make you competitive." },
  { icon: BookOpen, title: "Learning Center", desc: "Turn saved articles and tips into a personalized action plan." },
];

function Nav() {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="font-extrabold text-lg text-white font-serif-display">The <span style={{ color: "var(--gold)" }}>Applicant</span></span>
      <div className="flex items-center gap-3">
        <Link to="/demo" className="text-sm font-semibold text-white/80 hover:text-white">Demo</Link>
        <Link to="/login" className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[var(--gold)] text-slate-900 text-sm font-bold hover:brightness-105">Sign in</Link>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen relative z-10">
      {/* Hero */}
      <div className="hero-dark">
        <Nav />
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 relative">
          <div className="absolute right-0 top-8 w-72 h-72 rounded-full hidden md:block" style={{ background: "radial-gradient(circle, rgba(245,184,0,0.28), transparent 70%)" }} />
          <div className="relative max-w-2xl">
            <div className="flex items-center gap-2 text-[var(--gold)] text-xs font-bold uppercase tracking-[0.15em] mb-3"><Sparkles className="w-4 h-4" /> AI job-hunt platform</div>
            <h1 className="hero-serif text-4xl md:text-6xl text-white">Apply in your voice — not spray-and-pray.</h1>
            <p className="text-white/60 text-lg mt-5 max-w-xl">The Applicant finds better jobs, tailors every application in your authentic voice, and helps you apply with confidence — safely.</p>
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link to="/login" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--gold)] text-slate-900 font-bold hover:brightness-105">Get started free <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/demo" className="inline-flex items-center gap-2 h-12 px-6 rounded-full border border-white/25 text-white font-semibold hover:bg-white/10"><Play className="w-4 h-4" /> Watch the demo</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold text-white font-serif-display text-center mb-2">Everything you need, in one place</h2>
        <p className="text-center text-white/50 mb-8">A full-stack toolkit — not a single trick.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 card-hover">
              <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center mb-3"><f.icon className="w-5 h-5 text-brand" /></div>
              <div className="font-bold text-slate-800">{f.title}</div>
              <div className="text-sm text-slate-500 mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why us */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-800 font-serif-display mb-4">Why The Applicant is different</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Writes in your voice — not generic templates",
              "Relevance-scored matches — fewer off-target roles",
              "Live, multi-factor ATS scoring",
              "Human-in-the-loop apply — no ban-risk automation",
              "All-in-one: search, tailor, apply, track, portfolio, career",
              "Security-first: your data stays yours",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm text-slate-600"><Check className="w-4 h-4 text-emerald-500 shrink-0" />{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="max-w-5xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold text-white font-serif-display text-center mb-2">Simple, honest pricing</h2>
        <p className="text-center text-white/50 mb-8">Start free. Upgrade when you're ready.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { name: "Free", p: PRICING.free, feats: ["Job search", "Learning Center", "1 profile"], accent: "2A2440" },
            { name: "Basic", p: PRICING.basic, feats: ["Everything in Free", "AI Optimizer + Voice Studio", "Assisted apply", "Portfolio & Career", "Up to 3 profiles"], accent: "FF6B35", popular: true },
            { name: "Pro", p: PRICING.pro, feats: ["Everything in Basic", "Auto-apply (guided)", "Up to 25 profiles", "Priority AI"], accent: "F5B800" },
          ].map((pl) => (
            <div key={pl.name} className="card p-6" style={{ boxShadow: pl.popular ? "0 0 0 2px rgba(255,107,53,0.4)" : undefined }}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-lg" style={{ color: pl.accent === "2A2440" ? "#334155" : `#${pl.accent}` }}>{pl.name}</div>
                {pl.popular && <span className="chip bg-brand-light text-brand">Popular</span>}
              </div>
              <div className="mt-2 mb-4"><span className="text-3xl font-extrabold text-slate-900">{pl.p.price}</span><span className="text-sm text-slate-400"> {pl.p.period}</span></div>
              <ul className="space-y-2 mb-5">{pl.feats.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-slate-600"><Check className="w-4 h-4 text-emerald-500 shrink-0" />{f}</li>)}</ul>
              <Link to="/login" className="btn-primary w-full">Choose {pl.name}</Link>
            </div>
          ))}
        </div>
      </div>

      {/* For organizations (B2B) */}
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="card p-8" style={{ background: "linear-gradient(135deg, #17131f, #2a2440)" }}>
          <div className="flex items-center gap-2 mb-2"><Building2 className="w-5 h-5 text-[color:var(--gold)]" /><span className="text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--gold)]">For organizations</span></div>
          <h2 className="text-2xl font-bold text-white font-serif-display mb-3">Career centers, universities, employers & staffing firms</h2>
          <p className="text-white/60 mb-6 max-w-2xl">Give every person you serve personalized, high-quality applications — with the admin controls to manage access, seats, and support at scale.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              ["Admin console", "Manage all accounts centrally"],
              ["Access control", "Grant/revoke features per user, with expiry"],
              ["Seats & tiers", "Flexible packaging for your cohort"],
              ["Security & privacy", "Isolation, export, deletion built in"],
            ].map((c) => (
              <div key={c[0]} className="rounded-xl bg-white/5 p-4">
                <div className="font-semibold text-white text-sm">{c[0]}</div>
                <div className="text-xs text-white/50 mt-1">{c[1]}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-2xl font-extrabold text-white">{PRICING.org.price}</span>
            <span className="text-white/50">{PRICING.org.period}</span>
            <a href="mailto:sales@theapplicant.app?subject=Organization%20plan%20enquiry" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--gold)] text-slate-900 font-bold hover:brightness-105">Contact sales <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto px-6 py-10 flex items-center justify-between flex-wrap gap-3 border-t border-white/10">
        <span className="text-white/40 text-sm">The Applicant — applies in your voice.</span>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/demo" className="text-white/60 hover:text-white">Demo</Link>
          <Link to="/login" className="text-white/60 hover:text-white">Sign in</Link>
          <span className="text-white/40 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secure by design</span>
        </div>
      </div>
    </div>
  );
}
