import { useState, useEffect } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, Mic, Loader2, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Resume() {
  const { user } = useAuth();
  const isPaid = user?.subscriptionTier === "basic" || user?.subscriptionTier === "pro";
  const utils = trpc.useUtils();
  const profiles = trpc.resume.listProfiles.useQuery();
  const create = trpc.resume.createProfile.useMutation();
  const update = trpc.resume.updateProfile.useMutation();
  const analyzeVoice = trpc.resume.analyzeAndSaveVoice.useMutation();

  const current = profiles.data?.[0];
  const versions = trpc.resume.listVersions.useQuery(
    { resumeProfileId: current?.id ?? 0 },
    { enabled: !!current },
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [voiceSample, setVoiceSample] = useState("");

  useEffect(() => {
    if (current) {
      setFullName(current.fullName ?? "");
      setEmail(current.email ?? "");
      setPhone(current.phone ?? "");
      setText(current.baseResumeText ?? "");
    }
  }, [current?.id]);

  const save = async () => {
    try {
      if (current) {
        await update.mutateAsync({ id: current.id, fullName, email, phone, baseResumeText: text });
      } else {
        await create.mutateAsync({ fullName, email, phone, baseResumeText: text, isDefault: true });
      }
      await utils.resume.listProfiles.invalidate();
      toast.success("Resume saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const generateVoice = async () => {
    if (!current) return toast.error("Save your resume first");
    if (voiceSample.trim().length < 100) return toast.error("Paste a longer writing sample (100+ chars)");
    try {
      const res = await analyzeVoice.mutateAsync({ resumeProfileId: current.id, samples: [voiceSample] });
      if (res.success) { await utils.resume.listProfiles.invalidate(); toast.success("Voice profile created — AI will now write like you"); }
      else toast.error(res.error ?? "Failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Resume</h1>
      <p className="page-subtitle mb-5">Your base resume — the source everything is tailored from.</p>

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input mt-1" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" placeholder="jane@email.com" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input mt-1" placeholder="(555) 555-5555" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">Base resume text</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="textarea mt-1 min-h-[260px]" placeholder="Paste your full resume here — experience, skills, education…" />
        </div>
        <button onClick={save} disabled={create.isPending || update.isPending} className="btn-primary">
          {(create.isPending || update.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save resume
        </button>
      </div>

      {/* Voice profile */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Your voice profile</h3>
          {current?.voiceProfile && <span className="chip bg-emerald-100 text-emerald-700">Active</span>}
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Paste a writing sample (a past cover letter, bio, or LinkedIn summary). The AI learns your
          tone so tailored resumes and letters sound authentically like you.
        </p>
        {isPaid ? (
          <>
            <textarea value={voiceSample} onChange={(e) => setVoiceSample(e.target.value)} className="textarea min-h-[100px]" placeholder="Paste a sample of your writing…" />
            <button onClick={generateVoice} disabled={analyzeVoice.isPending} className="btn-ghost mt-3">
              {analyzeVoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analyze my voice
            </button>
          </>
        ) : (
          <Link to="/billing" className="btn-ghost"><Sparkles className="w-4 h-4" /> Upgrade to build a voice profile</Link>
        )}
      </div>

      {/* Saved versions */}
      {(versions.data?.length ?? 0) > 0 && (
        <div className="card p-5 mt-4">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Saved documents</h3>
          <div className="space-y-2">
            {versions.data?.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <FileText className="w-4 h-4 text-brand" />
                <div className="flex-1 text-sm text-slate-700">
                  {v.tailoredResumeText ? "Tailored resume" : v.coverLetter ? "Cover letter" : "Document"}
                  {v.jobRef && <span className="text-slate-400"> · {v.jobRef}</span>}
                </div>
                <span className="text-xs text-slate-400">{new Date(v.createdAt ?? Date.now()).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
