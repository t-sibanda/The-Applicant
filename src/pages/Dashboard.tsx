import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Counter, Ring } from "@/components/ui";
import {
  Briefcase, Send, Target,
  ArrowRight, Sparkles, Check, ChevronRight,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, suffix, color, delay, to }: { icon: React.ElementType; label: string; value: number; suffix?: string; color: string; delay: number; to: string }) {
  return (
    <Link to={to} className={`card p-4 card-hover animate-fade-in stagger-${delay} group block`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-extrabold text-slate-900 font-display"><Counter value={value} suffix={suffix} /></div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </Link>
  );
}

type StageItem = { label: string; done: boolean; to: string };

function StageCard(props: {
  step: number;
  title: string;
  subtitle: string;
  color: string;
  items: StageItem[];
  action: { label: string; to: string };
  delay: number;
}) {
  const done = props.items.filter((i) => i.done).length;
  const pct = props.items.length ? Math.round((done / props.items.length) * 100) : 0;
  return (
    <div className={`card p-5 flex flex-col animate-fade-in stagger-${props.delay}`}>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] font-extrabold uppercase tracking-[0.14em]"
          style={{ color: props.color }}
        >
          {props.step}. {props.title}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">{pct}%</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{props.subtitle}</p>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: props.color }}
        />
      </div>
      <ul className="space-y-1.5 mb-4 flex-1">
        {props.items.map((i) => (
          <li key={i.label}>
            <Link
              to={i.to}
              className={`flex items-center gap-2 text-xs font-medium rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-slate-50 ${i.done ? "text-emerald-600" : "text-slate-500"}`}
            >
              {i.done
                ? <Check className="w-3.5 h-3.5 shrink-0" />
                : <span className="w-3.5 h-3.5 shrink-0 rounded-full border border-slate-300 inline-block" />}
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={props.action.to}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold text-white transition-all active:scale-95"
        style={{ background: props.color }}
      >
        {props.action.label} <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const stats = trpc.dashboard.stats.useQuery();
  const analytics = trpc.dashboard.analytics.useQuery();
  const nudges = trpc.dashboard.nudges.useQuery();
  const profiles = trpc.profiles.list.useQuery();
  const resumes = trpc.resume.listProfiles.useQuery();
  const learning = trpc.learning.list.useQuery();
  const s = stats.data;
  const a = analytics.data;

  const resume = resumes.data?.[0];
  const hasActiveProfile = (profiles.data ?? []).some((p) => p.isActive);
  const hasResume = !!resume?.baseResumeText?.trim();
  const hasVoice = !!(resume?.voiceProfile?.trim() || resume?.voiceJson);

  const totalJobs = s?.totalJobs ?? 0;
  const totalApps = s?.totalApplications ?? 0;
  const interviews = s?.interviews ?? 0;
  const learningCount = learning.data?.length ?? 0;

  // The single best next action per stage, derived from live state.
  const prepareAction = !hasActiveProfile
    ? { label: "Set up your profile", to: "/setup" }
    : !hasResume
      ? { label: "Add your resume", to: "/setup" }
      : !hasVoice
        ? { label: "Teach it your voice", to: "/setup" }
        : { label: "Review profile", to: "/setup" };

  const applyAction = totalJobs === 0
    ? { label: "Find jobs", to: "/jobs" }
    : totalApps === 0
      ? { label: "Add your first job", to: "/jobs" }
      : { label: "Find the next role", to: "/jobs" };

  const advanceAction = interviews > 0
    ? { label: "Prep for interviews", to: "/applications" }
    : totalApps > 0
      ? { label: "Refine your applications", to: "/applications" }
      : { label: "Track applications", to: "/applications" };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-5xl">
      {/* Hero — blends into the immersive page canvas */}
      <div className="p-2 md:p-4 text-white mb-6 animate-fade-in relative">
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-[var(--gold)] text-xs font-semibold uppercase tracking-[0.15em] mb-3">
            <Sparkles className="w-4 h-4" /> {greeting}
          </div>
          <h1 className="hero-serif text-3xl md:text-5xl">
            {user?.name ? <>{user.name.split(" ")[0]}, let's land<br />your next role.</> : "Let's land your next role."}
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-4 max-w-lg leading-relaxed">
            Set up your profile once, add jobs and get a real match, then tailor and track every application in one place.
          </p>
        </div>
      </div>

      {/* Journey map — the product flow as a progress track */}
      <h2 className="font-serif-display text-xl text-white mb-3">Your journey</h2>
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <StageCard
          step={1}
          title="Set up"
          subtitle="Who you are. Fill this in once."
          color="#c2410c"
          delay={1}
          items={[
            { label: "Active profile", done: hasActiveProfile, to: "/setup" },
            { label: "Base resume", done: hasResume, to: "/setup" },
            { label: "Voice profile", done: hasVoice, to: "/setup" },
          ]}
          action={prepareAction}
        />
        <StageCard
          step={2}
          title="Find & apply"
          subtitle="Add jobs, get a match, tailor documents."
          color="#1d4ed8"
          delay={2}
          items={[
            { label: "Jobs found", done: totalJobs > 0, to: "/jobs" },
            { label: "Applications started", done: totalApps > 0, to: "/applications" },
            { label: "Documents tailored", done: totalApps > 0, to: "/applications" },
          ]}
          action={applyAction}
        />
        <StageCard
          step={3}
          title="Track"
          subtitle="Refine documents, follow outcomes, land interviews."
          color="#047857"
          delay={3}
          items={[
            { label: "Applications logged", done: totalApps > 0, to: "/applications" },
            { label: "Interviews landed", done: interviews > 0, to: "/applications" },
            { label: "Resources saved", done: learningCount > 0, to: "/growth" },
          ]}
          action={advanceAction}
        />
      </div>

      {/* Nudges: real, actionable next steps derived from your records */}
      {(nudges.data?.nudges.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className="font-serif-display text-xl text-white mb-3">Do this next</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {nudges.data!.nudges.map((n) => (
              <Link key={n.id} to="/applications" className="card p-4 card-hover block">
                <div className="text-sm font-bold text-slate-800">{n.title}</div>
                <div className="text-xs text-slate-500 mt-1">{n.detail}</div>
                <div className="text-xs font-semibold text-brand mt-2 inline-flex items-center gap-1">{n.cta} <ChevronRight className="w-3.5 h-3.5" /></div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Outcomes: proof the process is working, all from real data */}
      {a && a.sampleSize > 0 && (
        <div className="mb-6">
          <h2 className="font-serif-display text-xl text-white mb-3">Your outcomes</h2>
          <div className="card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{a.sent}</div>
                <div className="text-xs text-slate-500">Applications sent</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{a.responseRate}%</div>
                <div className="text-xs text-slate-500">Response rate</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{a.interviewRate}%</div>
                <div className="text-xs text-slate-500">Interview rate</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{a.medianResponseDays ?? "—"}{a.medianResponseDays != null ? "d" : ""}</div>
                <div className="text-xs text-slate-500">Median time to reply</div>
              </div>
            </div>

            {/* Honest insight only when both groups have enough samples */}
            {a.tailoring.tailoredCount >= 3 && a.tailoring.untailoredCount >= 3 && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 mb-2">
                Tailored applications got interviews at <span className="font-bold text-slate-800">{a.tailoring.tailoredInterviewRate}%</span> vs <span className="font-bold text-slate-800">{a.tailoring.untailoredInterviewRate}%</span> for untailored. Tailoring is worth the few minutes.
              </div>
            )}
            {a.atsBands.high.total >= 3 && a.atsBands.low.total >= 3 && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                High-ATS drafts (70%+) interviewed at <span className="font-bold text-slate-800">{a.atsBands.high.interviewRate}%</span>; low ones (under 50%) at <span className="font-bold text-slate-800">{a.atsBands.low.interviewRate}%</span>. Push each draft higher before sending.
              </div>
            )}
            {a.sampleSize < 5 && (
              <p className="text-[11px] text-slate-400 mt-1">Send a few more applications and these numbers get more meaningful.</p>
            )}
          </div>
        </div>
      )}

      {/* Stats + match ring */}
      <div className="grid md:grid-cols-[1fr_auto] gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Briefcase} label="Jobs found" value={totalJobs} color="#1d4ed8" delay={1} to="/jobs" />
          <StatCard icon={Send} label="Applications" value={totalApps} color="#c2410c" delay={2} to="/applications" />
          <StatCard icon={Target} label="Interviews" value={interviews} color="#047857" delay={3} to="/applications" />
        </div>
        <Link to="/applications" className="card p-5 flex items-center gap-4 animate-fade-in stagger-3 card-hover group">
          <div className="relative">
            <Ring value={s?.matchRate ?? 0} />
            <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-800">
              <Counter value={s?.matchRate ?? 0} suffix="%" />
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-800 flex items-center gap-1">Match rate <ArrowRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" /></div>
            <div className="text-xs text-slate-500 max-w-[140px]">Interviews per application</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
