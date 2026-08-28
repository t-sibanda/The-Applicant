import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Loader2, Sparkles, BookOpen, Lightbulb } from "lucide-react";

const CATS = [
  { id: "all", label: "All" },
  { id: "tip", label: "Tips" },
  { id: "resume", label: "Resume" },
  { id: "career", label: "Career" },
  { id: "industry", label: "Industry" },
] as const;

const CAT_STYLE: Record<string, string> = {
  tip: "bg-amber-100 text-amber-700",
  resume: "bg-blue-100 text-blue-700",
  career: "bg-violet-100 text-violet-700",
  industry: "bg-emerald-100 text-emerald-700",
};

export default function Learning({ embedded }: { embedded?: boolean } = {}) {
  const utils = trpc.useUtils();
  const [cat, setCat] = useState<string>("all");
  const items = trpc.learning.list.useQuery({ category: cat });
  const add = trpc.learning.add.useMutation();
  const remove = trpc.learning.remove.useMutation();
  const digest = trpc.learning.digest.useMutation();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"tip" | "resume" | "career" | "industry">("tip");
  const [digestData, setDigestData] = useState<any | null>(null);

  const save = async () => {
    if (!url.trim()) return toast.error("Paste a link");
    await add.mutateAsync({ url, title: title || undefined, category });
    setUrl(""); setTitle("");
    await utils.learning.list.invalidate();
    toast.success("Saved. We've pulled out the key points for you.");
  };

  const runDigest = async () => {
    const res = await digest.mutateAsync();
    if (!res.success) return toast.error(res.error ?? "Failed");
    setDigestData(res.digest);
    toast.success("Digest ready");
  };

  return (
    <div className={embedded ? "" : "max-w-4xl"}>
      {!embedded && <h1 className="page-title">Learning Center</h1>}
      {!embedded && (
        <p className="page-subtitle mb-5">
          Save the LinkedIn posts, articles, and tips worth keeping. We'll pull out what matters and fold it into your profile and portfolio.
        </p>
      )}

      {/* Add form */}
      <div className="card p-4 mb-4">
        <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link (LinkedIn post, article…)" className="input" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label (optional)" className="input" />
          <select value={category} onChange={(e) => setCategory(e.target.value as never)} className="input">
            <option value="tip">Tip</option>
            <option value="resume">Resume</option>
            <option value="career">Career</option>
            <option value="industry">Industry</option>
          </select>
          <button onClick={save} disabled={add.isPending} className="btn-primary">
            {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      </div>

      {/* Filters + digest */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1.5">
          {CATS.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${cat === c.id ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <button onClick={runDigest} disabled={digest.isPending} className="btn-ghost h-9">
          {digest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Build action plan
        </button>
      </div>

      {/* Digest result */}
      {digestData && (
        <div className="card p-5 mb-4 animate-fade-in" style={{ background: "linear-gradient(135deg,#fef3c7,#fff)" }}>
          <div className="flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Your profile action plan</h3></div>
          {digestData.themes?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">{digestData.themes.map((t: string, i: number) => <span key={i} className="chip bg-white text-slate-600">{t}</span>)}</div>
          )}
          <ul className="space-y-1.5">{(digestData.actions ?? []).map((a: string, i: number) => <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-brand">▸</span>{a}</li>)}</ul>
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {items.data?.map((it) => (
          <div key={it.id} className="card p-4 card-hover">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a href={it.url} target="_blank" rel="noreferrer" className="font-semibold text-sm text-slate-800 hover:text-brand truncate">{it.title}</a>
                  <span className={`chip ${CAT_STYLE[it.category] ?? "bg-slate-100 text-slate-500"}`}>{it.category}</span>
                  <a href={it.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-brand"><ExternalLink className="w-3.5 h-3.5" /></a>
                </div>
                {it.summary && <p className="text-xs text-slate-500 mt-1">{it.summary}</p>}
                {((it.takeaways as string[]) ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1">{((it.takeaways as string[]) ?? []).map((t, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-600"><span className="text-brand">•</span>{t}</li>
                  ))}</ul>
                )}
              </div>
              <button onClick={async () => { await remove.mutateAsync({ id: it.id }); await utils.learning.list.invalidate(); }} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {items.data?.length === 0 && (
          <div className="card p-8 text-center">
            <BookOpen className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-500">Nothing saved yet. Paste a LinkedIn post or article link above and we'll pull out the key tips for you.</p>
          </div>
        )}
      </div>
    </div>
  );
}
