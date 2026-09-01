import { useState, useEffect } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, Mic, Loader2, FileText, Eye, Download, X, Linkedin, Wand2, ArrowUpToLine, Trash2 } from "lucide-react";

export default function Resume() {
  const utils = trpc.useUtils();
  const profiles = trpc.resume.listProfiles.useQuery();
  const create = trpc.resume.createProfile.useMutation();
  const update = trpc.resume.updateProfile.useMutation();
  const curate = trpc.resume.curateFromPaste.useMutation();
  const createVersion = trpc.resume.createVersion.useMutation();
  const promoteVersion = trpc.resume.promoteVersion.useMutation();
  const deleteVersion = trpc.resume.deleteVersion.useMutation();

  const current = profiles.data?.[0];
  const versions = trpc.resume.listVersions.useQuery(
    { resumeProfileId: current?.id ?? 0 },
    { enabled: !!current },
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [viewing, setViewing] = useState<{ label: string; content: string } | null>(null);

  // Import / curate from pasted info (e.g. your LinkedIn export).
  const [importOpen, setImportOpen] = useState(false);
  const [pastedInfo, setPastedInfo] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "rewrite" | "targeted">("merge");
  const [importPreview, setImportPreview] = useState("");

  const runCurate = async (save: boolean) => {
    if (pastedInfo.trim().length < 20) return toast.error("Paste your LinkedIn export or resume details");
    try {
      const res = await curate.mutateAsync({ pastedInfo, mode: importMode, save });
      if (!res.success || !res.content) return toast.error(res.error ?? "Failed");
      setImportPreview(res.content);
      if (save) {
        setText(res.content);
        await utils.resume.listProfiles.invalidate();
        toast.success("Saved as your base resume.");
      } else {
        toast.success("Draft ready below. Review, then save it.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

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

  const saveAsSample = async () => {
    if (!current) return toast.error("Save your base resume first");
    if (text.trim().length < 20) return toast.error("Add resume text before saving a sample");
    const label = window.prompt("Name this resume sample (for example: Product Manager)");
    if (label === null) return; // cancelled
    try {
      await createVersion.mutateAsync({
        resumeProfileId: current.id,
        label: label.trim() || undefined,
        tailoredResumeText: text,
      });
      await utils.resume.listProfiles.invalidate();
      await versions.refetch();
      toast.success("Saved as a resume sample.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const promote = async (versionId: number) => {
    if (!window.confirm("Promote this sample to your base resume? Your current base resume text will be replaced. The sample is kept.")) return;
    try {
      await promoteVersion.mutateAsync({ versionId });
      await utils.resume.listProfiles.invalidate();
      toast.success("Promoted to your base resume.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const removeSample = async (versionId: number) => {
    if (!window.confirm("Delete this saved sample? This cannot be undone. Your base resume is not affected.")) return;
    try {
      await deleteVersion.mutateAsync({ versionId });
      await versions.refetch();
      toast.success("Sample deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Resume</h1>
      <p className="page-subtitle mb-5">Your base resume. Everything else gets tailored from this.</p>

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
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="textarea mt-1 min-h-[260px]" placeholder="Paste your full resume here. Experience, skills, education…" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={save} disabled={create.isPending || update.isPending} className="btn-primary">
            {(create.isPending || update.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save resume
          </button>
          {current && (
            <button onClick={saveAsSample} disabled={createVersion.isPending} className="btn-ghost" title="Keep this as a named sample for a role type. It won't be overwritten when you update your base resume.">
              {createVersion.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Save as sample
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          Saving your base resume never deletes your samples. Use "Save as sample" to keep versions for different roles.
        </p>
      </div>

      {/* Import from LinkedIn / paste details */}
      <div className="card p-5 mt-4">
        <button onClick={() => setImportOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
          <Linkedin className="w-4 h-4 text-[#0a66c2]" />
          <h3 className="font-bold text-sm text-slate-800">Import from LinkedIn or paste details</h3>
          <span className="ml-auto text-slate-300 text-lg leading-none">{importOpen ? "−" : "+"}</span>
        </button>
        {importOpen && (
          <div className="mt-3 space-y-3">
            <div className="text-xs text-slate-500 leading-relaxed rounded-lg bg-slate-50 p-3">
              LinkedIn doesn't allow apps to read your profile directly, but you can export it yourself:
              open your LinkedIn profile, use <span className="font-semibold">More → Save to PDF</span> (or
              Settings → Data privacy → Get a copy of your data), then paste the text here. We'll build or
              enrich your resume from it, in your voice. Nothing is sent to LinkedIn.
            </div>
            <textarea value={pastedInfo} onChange={(e) => setPastedInfo(e.target.value)} className="textarea min-h-[140px]" placeholder="Paste your LinkedIn export, another resume, or extra experience and achievements…" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">How should we use it?</span>
              {([["merge", "Merge with my resume"], ["rewrite", "Rebuild from this"], ["targeted", "Target a role"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => setImportMode(m)} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${importMode === m ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => runCurate(false)} disabled={curate.isPending} className="btn-ghost">
                {curate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Preview
              </button>
              <button onClick={() => runCurate(true)} disabled={curate.isPending} className="btn-primary">
                {curate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Curate & save as base resume
              </button>
            </div>
            {importPreview && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {importPreview}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice profile: managed on the Voice page. Shown here read only so the
          same writing sample is never captured in two places. */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Your voice profile</h3>
          {current?.voiceProfile
            ? <span className="chip bg-emerald-100 text-emerald-700">Active</span>
            : <span className="chip bg-slate-100 text-slate-500">Not set up</span>}
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Your voice profile teaches the AI to write tailored resumes and letters that sound like you.
          It lives on the Voice page so it is set up in one place.
        </p>
        <Link to="/voice" className="btn-ghost">
          <Mic className="w-4 h-4" /> {current?.voiceProfile ? "Manage on the Voice page" : "Set up on the Voice page"}
        </Link>
      </div>

      {/* Saved resume samples */}
      {(versions.data?.length ?? 0) > 0 && (
        <div className="card p-5 mt-4">
          <h3 className="font-bold text-sm text-slate-800 mb-1">Saved resume samples</h3>
          <p className="text-xs text-slate-500 mb-3">Keep versions for different roles. Promote one to make it your base resume, or download it any time.</p>
          <div className="space-y-2">
            {versions.data?.map((v) => {
              const content = v.tailoredResumeText || v.coverLetter || "";
              const kind = v.tailoredResumeText ? "Resume" : v.coverLetter ? "Cover letter" : "Document";
              const displayLabel =
                v.label?.trim() ||
                v.jobRef?.trim() ||
                `${kind} · ${new Date(v.createdAt ?? Date.now()).toLocaleDateString()}`;
              const canPromote = !!v.tailoredResumeText;
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <FileText className="w-4 h-4 text-brand shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 truncate">{displayLabel}</div>
                    <div className="text-[11px] text-slate-400">{kind} · {new Date(v.createdAt ?? Date.now()).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => setViewing({ label: displayLabel, content })} className="btn-ghost h-8 px-3 text-xs"><Eye className="w-3.5 h-3.5" /> View</button>
                  <button
                    onClick={() => {
                      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${displayLabel.replace(/\s+/g, "_")}.txt`;
                      a.click();
                    }}
                    className="btn-ghost h-8 px-3 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  {canPromote && (
                    <button onClick={() => promote(v.id)} disabled={promoteVersion.isPending} className="btn-ghost h-8 px-3 text-xs" title="Make this your base resume (the sample is kept)">
                      <ArrowUpToLine className="w-3.5 h-3.5" /> Promote
                    </button>
                  )}
                  <button onClick={() => removeSample(v.id)} disabled={deleteVersion.isPending} className="btn-ghost h-8 px-3 text-xs text-rose-500" title="Delete this sample">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Document viewer modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="card max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-sm text-slate-800">{viewing.label}</h3>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">{viewing.content || "(empty)"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
