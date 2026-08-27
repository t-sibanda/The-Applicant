import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Counter, Ring } from "@/components/ui";
import {
  Briefcase, Send, Target, Bot, FileText, User, GraduationCap,
  LayoutTemplate, ArrowRight, Sparkles,
} from "lucide-react";

const QUICK = [
  { to: "/optimizer", icon: Bot, title: "AI Optimizer", desc: "Tailor & improve", grad: "linear-gradient(135deg,#ffedd5,#fed7aa)", color: "#c2410c" },
  { to: "/jobs", icon: Briefcase, title: "Find Jobs", desc: "Search & filter", grad: "linear-gradient(135deg,#dbeafe,#bfdbfe)", color: "#1d4ed8" },
  { to: "/portfolio", icon: LayoutTemplate, title: "Portfolio", desc: "Market yourself", grad: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#6d28d9" },
  { to: "/career", icon: GraduationCap, title: "Career Builder", desc: "Plan your path", grad: "linear-gradient(135deg,#d1fae5,#a7f3d0)", color: "#047857" },
];

function StatCard({ icon: Icon, label, value, suffix, color, delay }: { icon: React.ElementType; label: string; value: number; suffix?: string; color: string; delay: number }) {
  return (
    <div className={`card p-4 card-hover animate-fade-in stagger-${delay}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-slate-900 font-display"><Counter value={value} suffix={suffix} /></div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const stats = trpc.dashboard.stats.useQuery();
  const profiles = trpc.profiles.list.useQuery();
  const s = stats.data;
  const isNew = !profiles.isLoading && (profiles.data?.length ?? 0) === 0;

  return (
    <div className="max-w-5xl">
      {/* Hero — blends into the immersive page canvas */}
      <div className="p-2 md:p-4 text-white mb-6 animate-fade-in relative">
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-[var(--gold)] text-xs font-semibold uppercase tracking-[0.15em] mb-3">
            <Sparkles className="w-4 h-4" /> Welcome back
          </div>
          <h1 className="hero-serif text-3xl md:text-5xl">
            {user?.name ? <>Hi {user.name.split(" ")[0]}, let's<br />land your next role.</> : "Land your next role with confidence."}
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-4 max-w-lg leading-relaxed">
            Your AI-powered command center — find better jobs, tailor every application, and build a standout profile that markets you.
          </p>
          <div className="flex gap-3 mt-6">
            <Link to="/optimizer" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--gold)] text-slate-900 text-sm font-bold hover:brightness-105 transition-all active:scale-95">
              <Bot className="w-4 h-4" /> Open Optimizer
            </Link>
            <Link to="/jobs" className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/25 text-white text-sm font-semibold hover:bg-white/10 transition-all active:scale-95">
              <Briefcase className="w-4 h-4" /> Find jobs
            </Link>
          </div>
        </div>
      </div>

      {isNew && (
        <div className="card p-5 mb-6 animate-fade-in stagger-1">
          <h2 className="font-bold text-slate-800 mb-3">Get started in 3 steps</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { to: "/profiles", icon: User, t: "Create a profile", d: "Set target industry & role" },
              { to: "/resume", icon: FileText, t: "Add your resume", d: "The AI tailors from this" },
              { to: "/jobs", icon: Briefcase, t: "Search jobs", d: "Filtered to your goals" },
            ].map((st, i) => (
              <Link key={st.to} to={st.to} className={`tile bg-slate-50 animate-fade-in stagger-${i + 2}`}>
                <st.icon className="w-5 h-5 text-brand mb-2" />
                <div className="font-semibold text-sm text-slate-800">{st.t}</div>
                <div className="text-xs text-slate-500">{st.d}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats + match ring */}
      <div className="grid md:grid-cols-[1fr_auto] gap-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Briefcase} label="Jobs found" value={s?.totalJobs ?? 0} color="#1d4ed8" delay={1} />
          <StatCard icon={Send} label="Applications" value={s?.totalApplications ?? 0} color="#c2410c" delay={2} />
          <StatCard icon={Target} label="Interviews" value={s?.interviews ?? 0} color="#047857" delay={3} />
        </div>
        <div className="card p-5 flex items-center gap-4 animate-fade-in stagger-3">
          <div className="relative">
            <Ring value={s?.matchRate ?? 0} />
            <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-800">
              <Counter value={s?.matchRate ?? 0} suffix="%" />
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-800">Match rate</div>
            <div className="text-xs text-slate-500 max-w-[140px]">Interviews per application</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="font-serif-display text-xl text-white mb-3">Jump back in</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK.map((q, i) => (
          <Link key={q.to} to={q.to} className={`tile animate-fade-in stagger-${i + 1}`} style={{ background: q.grad }}>
            <q.icon className="w-6 h-6 mb-3" style={{ color: q.color }} />
            <div className="font-bold text-sm" style={{ color: q.color }}>{q.title}</div>
            <div className="text-xs" style={{ color: q.color, opacity: 0.75 }}>{q.desc}</div>
            <ArrowRight className="w-4 h-4 absolute top-4 right-4" style={{ color: q.color, opacity: 0.5 }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
