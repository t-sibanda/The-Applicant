import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Mode = "tailor" | "cover" | "ats" | "chat";

export default function Optimizer() {
  const [mode, setMode] = useState<Mode>("tailor");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [result, setResult] = useState("");
  const [chatInput, setChatInput] = useState("");

  const profiles = trpc.resume.listProfiles.useQuery();
  const profile = profiles.data?.[0];

  const tailor = trpc.ai.tailorResume.useMutation();
  const cover = trpc.ai.generateCoverLetter.useMutation();
  const ats = trpc.ai.atsScore.useMutation();
  const chat = trpc.ai.chat.useMutation();

  const busy = tailor.isPending || cover.isPending || ats.isPending || chat.isPending;

  const run = async () => {
    if (mode === "chat") {
      if (!chatInput.trim()) return;
      try {
        const res = await chat.mutateAsync({
          messages: [{ role: "user", content: chatInput }],
        });
        setResult(res.success ? res.content ?? "" : `Error: ${res.error}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
      return;
    }

    if (!profile) return toast.error("Create a resume first");
    if (!jobDescription.trim()) return toast.error("Paste a job description");
    const voice = profile.voiceProfile || "Professional, results-driven, uses metrics and action verbs";

    try {
      if (mode === "tailor") {
        const res = await tailor.mutateAsync({ baseResume: profile.baseResumeText, voiceProfile: voice, jobDescription });
        setResult(res.success ? res.content ?? "" : `Error: ${res.error}`);
      } else if (mode === "cover") {
        const res = await cover.mutateAsync({ baseResume: profile.baseResumeText, voiceProfile: voice, jobDescription, companyName: companyName || "the company", jobTitle: jobTitle || "this role" });
        setResult(res.success ? res.content ?? "" : `Error: ${res.error}`);
      } else if (mode === "ats") {
        const res = await ats.mutateAsync({ resumeText: profile.baseResumeText, jobDescription });
        setResult(res.success ? res.content ?? "" : `Error: ${res.error}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const tabs: { id: Mode; label: string }[] = [
    { id: "tailor", label: "Tailor Resume" },
    { id: "cover", label: "Cover Letter" },
    { id: "ats", label: "ATS Score" },
    { id: "chat", label: "AI Chat" },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-1">AI Optimizer</h1>
      <p className="text-sm text-slate-500 mb-4">Tailor resumes, write cover letters, score ATS fit, and chat with your career coach.</p>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setMode(t.id); setResult(""); }} className={`px-3 py-2 rounded-lg text-xs font-semibold ${mode === t.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
        {mode === "chat" ? (
          <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 text-sm" placeholder="Ask anything about your job search…" />
        ) : (
          <>
            {mode === "cover" && (
              <div className="grid grid-cols-2 gap-2">
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
              </div>
            )}
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="w-full min-h-[160px] p-3 rounded-lg border border-slate-200 text-sm" placeholder="Paste the job description…" />
          </>
        )}
        <button onClick={run} disabled={busy} className="h-10 px-5 rounded-lg bg-brand text-white text-sm font-semibold">
          {busy ? "Working…" : "Run"}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 mt-4 whitespace-pre-wrap text-sm text-slate-700 max-h-[400px] overflow-y-auto">
          {result}
        </div>
      )}
    </div>
  );
}
