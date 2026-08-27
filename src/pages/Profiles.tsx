import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link2, StickyNote, Trash2, Mic, FileText } from "lucide-react";

export default function Profiles() {
  const utils = trpc.useUtils();
  const profiles = trpc.profiles.list.useQuery();
  const resumes = trpc.resume.listProfiles.useQuery();
  const saved = trpc.saved.list.useQuery();
  const create = trpc.profiles.create.useMutation();
  const setActive = trpc.profiles.setActive.useMutation();
  const del = trpc.profiles.delete.useMutation();
  const addSaved = trpc.saved.add.useMutation();
  const removeSaved = trpc.saved.remove.useMutation();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [note, setNote] = useState("");

  const resume = resumes.data?.[0];
  const hasVoice = !!resume?.voiceProfile;
  const hasResume = !!resume?.baseResumeText;
  const links = saved.data?.filter((s) => s.type === "link") ?? [];
  const notes = saved.data?.filter((s) => s.type === "note") ?? [];

  // Profile completeness: targeting + resume + voice + at least one saved item.
  const activeProfile = profiles.data?.find((p) => p.isActive);
  const completeness = [
    !!activeProfile,
    hasResume,
    hasVoice,
    (saved.data?.length ?? 0) > 0,
  ].filter(Boolean).length;
  const completenessPct = Math.round((completeness / 4) * 100);

  const refresh = () => utils.profiles.list.invalidate();

  const addLink = async () => {
    if (!linkUrl.trim()) return toast.error("Paste a URL");
    await addSaved.mutateAsync({ type: "link", url: linkUrl, title: linkTitle || linkUrl });
    setLinkUrl(""); setLinkTitle("");
    await utils.saved.list.invalidate();
    toast.success("Link saved");
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await addSaved.mutateAsync({ type: "note", notes: note });
    setNote("");
    await utils.saved.list.invalidate();
    toast.success("Note saved");
  };

  const remove = async (id: number) => {
    await removeSaved.mutateAsync({ id });
    await utils.saved.list.invalidate();
  };

  const add = async () => {
    if (!name.trim()) return toast.error("Give the profile a name");
    try {
      await create.mutateAsync({
        name,
        targetIndustry: industry || undefined,
        targetRole: role || undefined,
      });
      setName(""); setIndustry(""); setRole("");
      await refresh();
      toast.success("Profile created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Profiles</h1>
      <p className="page-subtitle mb-5">
        Your job-hunt hub: targeting, resume, voice, and saved links all in one place.
      </p>

      {/* Completeness */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Profile strength</span>
          <span className="chip bg-brand-light text-brand">{completenessPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${completenessPct}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className={`flex items-center gap-1.5 ${activeProfile ? "text-emerald-600" : "text-slate-400"}`}>● Active profile</div>
          <div className={`flex items-center gap-1.5 ${hasResume ? "text-emerald-600" : "text-slate-400"}`}>● Resume</div>
          <div className={`flex items-center gap-1.5 ${hasVoice ? "text-emerald-600" : "text-slate-400"}`}>● Voice profile</div>
          <div className={`flex items-center gap-1.5 ${(saved.data?.length ?? 0) > 0 ? "text-emerald-600" : "text-slate-400"}`}>● Saved items</div>
        </div>
      </div>

      {/* Create profile */}
      <div className="card p-4 mb-5 grid sm:grid-cols-4 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" className="input" />
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="input" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Target role" className="input" />
        <button onClick={add} disabled={create.isPending} className="btn-primary">Add</button>
      </div>

      <div className="space-y-2 mb-6">
        {profiles.data?.map((p) => (
          <div key={p.id} className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold text-sm text-slate-800">
                {p.name}{" "}
                {p.isActive && <span className="chip bg-brand-light text-brand ml-1">active</span>}
              </div>
              <div className="text-xs text-slate-500">
                {[p.targetRole, p.targetIndustry].filter(Boolean).join(" · ") || "No targeting set"}
              </div>
            </div>
            {!p.isActive && (
              <button onClick={async () => { await setActive.mutateAsync({ id: p.id }); await refresh(); }} className="text-xs font-semibold text-brand">Set active</button>
            )}
            <button onClick={async () => { await del.mutateAsync({ id: p.id }); await refresh(); }} className="text-xs text-slate-400 hover:text-rose-500">Delete</button>
          </div>
        ))}
        {profiles.data?.length === 0 && (
          <div className="card p-6 text-center text-sm text-slate-400">No profiles yet. Create one above.</div>
        )}
      </div>

      {/* Linked assets */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <Link to="/resume" className="card p-4 hover:shadow-lift transition-shadow">
          <FileText className="w-5 h-5 text-brand mb-2" />
          <div className="font-semibold text-sm text-slate-800">Resume</div>
          <div className="text-xs text-slate-500">{hasResume ? "Base resume saved" : "Not set — add yours"}</div>
        </Link>
        <Link to="/resume" className="card p-4 hover:shadow-lift transition-shadow">
          <Mic className="w-5 h-5 text-brand mb-2" />
          <div className="font-semibold text-sm text-slate-800">Voice profile</div>
          <div className="text-xs text-slate-500">{hasVoice ? "Active — AI writes in your tone" : "Not set — build one"}</div>
        </Link>
      </div>

      {/* Saved links */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Saved links &amp; jobs</h3>
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mb-3">
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Label" className="input" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="input" />
          <button onClick={addLink} disabled={addSaved.isPending} className="btn-primary">Save</button>
        </div>
        <div className="space-y-2">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <a href={l.url ?? "#"} target="_blank" rel="noreferrer" className="flex-1 text-sm text-slate-700 truncate hover:text-brand">{l.title || l.url}</a>
              <button onClick={() => remove(l.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {links.length === 0 && <p className="text-xs text-slate-400">No saved links yet.</p>}
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <StickyNote className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Notes</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jot down anything useful…" className="input flex-1" />
          <button onClick={addNote} disabled={addSaved.isPending} className="btn-primary">Add</button>
        </div>
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5">
              <StickyNote className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
              <div className="flex-1 text-sm text-slate-700">{n.notes}</div>
              <button onClick={() => remove(n.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
        </div>
      </div>
    </div>
  );
}
