import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles, Lock, Wand2, PenTool, BarChart3, MessageSquare,
  Target, GraduationCap, Copy, Download, Check, Send, Loader2, Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Assistant } from "@/components/Assistant";

type Mode = "assistant" | "tailor" | "cover" | "ats" | "chat" | "skillgap";

const TOOLS: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "assistant", label: "Assistant", icon: Bot, desc: "Improve resume live" },
  { id: "tailor", label: "Tailor Resume", icon: Wand2, desc: "Customize for a job" },
  { id: "cover", label: "Cover Letter", icon: PenTool, desc: "Generate a letter" },
  { id: "ats", label: "ATS Score", icon: BarChart3, desc: "Check compatibility" },
  { id: "skillgap", label: "Skill Gap", icon: Target, desc: "Find what to learn" },
  { id: "chat", label: "AI Coach", icon: MessageSquare, desc: "Ask anything" },
];

export default function Optimizer() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isPaid = user?.subscriptionTier === "basic" || user?.subscriptionTier === "pro";

  const [mode, setMode] = useState<Mode>("assistant");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [result, setResult] = useState("");
  const [ats, setAts] = useState<Record<string, unknown> | null>(null);
  const [gap, setGap] = useState<Record<string, unknown> | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);

  const profiles = trpc.resume.listProfiles.useQuery();
  const profile = profiles.data?.[0];

  const tailorMut = trpc.ai.tailorResume.useMutation();
  const coverMut = trpc.ai.generateCoverLetter.useMutation();
  const atsMut = trpc.ai.atsScore.useMutation();
  const chatMut = trpc.ai.chat.useMutation();
  const gapMut = trpc.ai.skillGap.useMutation();
  const createVersion = trpc.resume.createVersion.useMutation();
  const logApp = trpc.applications.create.useMutation();

  const busy =
    tailorMut.isPending || coverMut.isPending || atsMut.isPending ||
    chatMut.isPending || gapMut.isPending;

  const reset = () => { setResult(""); setAts(null); setGap(null); };

  const run = async () => {
    reset();
    if (mode === "chat") {
      if (!chatInput.trim()) return toast.error("Type a question first");
      const res = await chatMut.mutateAsync({ messages: [{ role: "user", content: chatInput }] }).catch((e) => { toast.error(e.message); return null; });
      if (res) setResult(res.success ? res.content ?? "" : `Error: ${res.error}`);
      return;
    }
    if (!profile?.baseResumeText) return toast.error("Add your resume first (Resume page)");
    if (!jobDescription.trim()) return toast.error("Paste a job description");
    const voice = profile.voiceProfile || "Professional, results-driven, uses metrics and action verbs";

    try {
      if (mode === "tailor") {
        const res = await tailorMut.mutateAsync({ baseResume: profile.baseResumeText, voiceProfile: voice, jobDescription });
        if (res.success && res.content) { setResult(res.content); toast.success("Resume tailored"); }
        else toast.error(res.error ?? "Failed");
      } else if (mode === "cover") {
        const res = await coverMut.mutateAsync({ baseResume: profile.baseResumeText, voiceProfile: voice, jobDescription, companyName: companyName || "the company", jobTitle: jobTitle || "this role" });
        if (res.success && res.content) { setResult(res.content); toast.success("Cover letter ready"); }
        else toast.error(res.error ?? "Failed");
      } else if (mode === "ats") {
        const res = await atsMut.mutateAsync({ resumeText: profile.baseResumeText, jobDescription });
        if (res.success && res.content) { try { setAts(JSON.parse(res.content)); } catch { setResult(res.content); } }
        else toast.error(res.error ?? "Failed");
      } else if (mode === "skillgap") {
        const res = await gapMut.mutateAsync({ resume: profile.baseResumeText, jobDescription });
        if (res.success && res.content) { try { setGap(JSON.parse(res.content)); } catch { setResult(res.content); } }
        else toast.error(res.error ?? "Failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("Copied");
  };

  const download = () => {
    const name = (profile?.fullName || "document").replace(/\s+/g, "_");
    const label = mode === "cover" ? "Cover_Letter" : "Resume";
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_${label}.txt`;
    a.click();
    toast.success("Downloaded");
  };

  const saveVersion = async () => {
    if (!profile) return;
    await createVersion.mutateAsync({
      resumeProfileId: profile.id,
      tailoredResumeText: mode === "tailor" ? result : undefined,
      coverLetter: mode === "cover" ? result : undefined,
      jobRef: jobTitle || companyName || undefined,
    });
    toast.success("Saved to your resume versions");
  };

  const logApplication = async () => {
    await logApp.mutateAsync({ companyName: companyName || jobTitle || "Application", status: "applied" });
    await utils.applications.list.invalidate();
    toast.success("Logged to Applications");
  };

  if (user && !isPaid) {
    return (
      <div className="max-w-3xl">
        <h1 className="page-title">AI Optimizer</h1>
        <p className="page-subtitle mb-6">Everything you need to sharpen an application, in one place.</p>
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-brand" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Turn on the AI Optimizer</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Tailor resumes to any job, write cover letters in your voice, check your ATS fit,
            spot skill gaps, and talk it through with a career coach.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-6 mb-6 max-w-lg mx-auto">
            {TOOLS.map((t) => (
              <div key={t.id} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50">
                <t.icon className="w-5 h-5 text-brand" />
                <span className="text-[11px] font-medium text-slate-600">{t.label}</span>
              </div>
            ))}
          </div>
          <Link to="/billing" className="btn-primary">
            <Sparkles className="w-4 h-4" /> Upgrade to turn it on
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">AI Optimizer</h1>
      <p className="page-subtitle mb-5">Tailor resumes, write letters, score ATS fit, plan skills, and get coaching.</p>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {TOOLS.map((t) => {
          const active = mode === t.id;
          return (
            <button key={t.id} onClick={() => { setMode(t.id); reset(); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${active ? "border-brand/30 bg-brand-light" : "border-transparent bg-white hover:shadow-card"}`}>
              <t.icon className={`w-5 h-5 ${active ? "text-brand" : "text-slate-400"}`} />
              <span className={`text-[11px] font-semibold ${active ? "text-brand" : "text-slate-600"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {mode === "assistant" && <Assistant />}

      {mode !== "assistant" && (
      <div className="card p-5 space-y-3">
        {mode === "chat" ? (
          <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="textarea min-h-[110px]" placeholder="Ask about interview prep, salary negotiation, career strategy…" />
        ) : (
          <>
            {mode === "cover" && (
              <div className="grid grid-cols-2 gap-2">
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" className="input" />
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" className="input" />
              </div>
            )}
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="textarea min-h-[170px]" placeholder="Paste the full job description here…" />
          </>
        )}
        <button onClick={run} disabled={busy} className="btn-primary w-full">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : <><Sparkles className="w-4 h-4" /> {TOOLS.find((t) => t.id === mode)?.label}</>}
        </button>
      </div>
      )}

      {/* Text result (tailor / cover / chat) */}
      {result && (
        <div className="card p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">Result</h3>
            <div className="flex gap-2">
              <button onClick={copyResult} className="btn-ghost h-9 px-3">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy</button>
              {(mode === "tailor" || mode === "cover") && <>
                <button onClick={download} className="btn-ghost h-9 px-3"><Download className="w-4 h-4" /> Download</button>
                <button onClick={saveVersion} className="btn-ghost h-9 px-3">Save</button>
                <button onClick={logApplication} className="btn-ghost h-9 px-3"><Send className="w-4 h-4" /> Log</button>
              </>}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 whitespace-pre-wrap text-sm text-slate-700 max-h-[420px] overflow-y-auto">{result}</div>
        </div>
      )}

      {/* ATS score */}
      {ats && (
        <div className="card p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800">ATS Compatibility</h3>
              <p className="text-[11px] text-slate-400">A read across several factors. Guidance, not any one vendor's engine.</p>
            </div>
            <div className="text-3xl font-extrabold text-brand">{String((ats as any).overallScore ?? "-")}%</div>
          </div>

          {/* Per-factor bars */}
          {(ats as any).breakdown && (
            <div className="space-y-2 mb-4">
              {Object.entries((ats as any).breakdown as Record<string, number>).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-600 capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                    <span className="text-slate-400">{v}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="text-xs font-bold text-emerald-700 mb-1">Matched keywords</div>
              <div className="flex flex-wrap gap-1">{((ats as any).keywordMatch?.matched ?? []).slice(0, 18).map((k: string, i: number) => <span key={i} className="chip bg-white text-emerald-700">{k}</span>)}</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <div className="text-xs font-bold text-rose-700 mb-1">Missing keywords</div>
              <div className="flex flex-wrap gap-1">{((ats as any).keywordMatch?.missing ?? []).slice(0, 18).map((k: string, i: number) => <span key={i} className="chip bg-white text-rose-700">{k}</span>)}</div>
            </div>
          </div>

          {((ats as any).hardRequirementGaps ?? []).length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3">
              <div className="text-xs font-bold text-amber-700 mb-1">Hard requirement checks</div>
              <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">{((ats as any).hardRequirementGaps ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {((ats as any).formatIssues ?? []).length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-600 mb-1">Formatting / parseability</div>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">{((ats as any).formatIssues ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {((ats as any).improvements ?? []).length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-600 mb-1">Prioritized improvements</div>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">{((ats as any).improvements ?? []).slice(0, 10).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Skill gap */}
      {gap && (
        <div className="card p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-800">Skill Gap Analysis</h3>
            <div className="text-3xl font-extrabold text-brand">{String((gap as any).readinessScore ?? "-")}%<span className="text-xs text-slate-400 font-normal ml-1">ready</span></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="text-xs font-bold text-emerald-700 mb-1">You already have</div>
              <div className="flex flex-wrap gap-1">{((gap as any).matchingSkills ?? []).map((k: string, i: number) => <span key={i} className="chip bg-white text-emerald-700">{k}</span>)}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="text-xs font-bold text-amber-700 mb-1">Worth developing</div>
              <div className="flex flex-wrap gap-1">{((gap as any).missingSkills ?? []).map((k: string, i: number) => <span key={i} className="chip bg-white text-amber-700">{k}</span>)}</div>
            </div>
          </div>
          {((gap as any).learningPlan ?? []).length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-600 mb-2">Learning plan</div>
              <div className="space-y-2">{((gap as any).learningPlan ?? []).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <GraduationCap className="w-4 h-4 text-brand shrink-0" />
                  <div className="flex-1"><div className="font-semibold text-sm text-slate-700">{p.skill}</div><div className="text-xs text-slate-500">{p.how}</div></div>
                  <span className="chip bg-white text-slate-500">{p.weeks}w</span>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
