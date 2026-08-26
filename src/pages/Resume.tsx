import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Resume() {
  const utils = trpc.useUtils();
  const profiles = trpc.resume.listProfiles.useQuery();
  const create = trpc.resume.createProfile.useMutation();
  const update = trpc.resume.updateProfile.useMutation();

  const current = profiles.data?.[0];
  const [fullName, setFullName] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (current) {
      setFullName(current.fullName ?? "");
      setText(current.baseResumeText ?? "");
    }
  }, [current?.id]);

  const save = async () => {
    try {
      if (current) {
        await update.mutateAsync({ id: current.id, fullName, baseResumeText: text });
      } else {
        await create.mutateAsync({ fullName, baseResumeText: text, isDefault: true });
      }
      await utils.resume.listProfiles.invalidate();
      toast.success("Resume saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Resume</h1>
      <p className="text-sm text-slate-500 mb-5">Your base resume — the source the AI tailors from.</p>

      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg border border-slate-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">Base resume text</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full mt-1 min-h-[280px] p-3 rounded-lg border border-slate-200 text-sm" placeholder="Paste your full resume here…" />
        </div>
        <button onClick={save} disabled={create.isPending || update.isPending} className="h-10 px-5 rounded-lg bg-brand text-white text-sm font-semibold">
          Save resume
        </button>
      </div>
    </div>
  );
}
