import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Trash2, ExternalLink, Loader2, Sparkles, BookOpen,
  GraduationCap, Target, ChevronRight, X, Wand2, Pin, Image as ImageIcon,
  Newspaper, RefreshCw,
} from "lucide-react";

type Topic = {
  id: number; name: string; kind: string; goal: string | null;
  overview: string | null; keyFacts: unknown; course: unknown; latest: unknown; progress: number; pinned: boolean;
};

export default function Learning({ embedded }: { embedded?: boolean } = {}) {
  const utils = trpc.useUtils();
  const topics = trpc.learning.listTopics.useQuery();
  const createTopic = trpc.learning.createTopic.useMutation();
  const buildTopic = trpc.learning.buildTopic.useMutation();
  const updateTopic = trpc.learning.updateTopic.useMutation();
  const removeTopic = trpc.learning.removeTopic.useMutation();
  const suggest = trpc.learning.suggestTopics.useMutation();
  const addItem = trpc.learning.add.useMutation();
  const ocr = trpc.learning.ocr.useMutation();
  const refreshLatest = trpc.learning.refreshLatest.useMutation();

  const [openId, setOpenId] = useState<number | null>(null);
  const openTopic = topics.data?.find((t) => t.id === openId) as Topic | undefined;
  const items = trpc.learning.list.useQuery(
    { topicId: openId ?? undefined },
    { enabled: openId != null },
  );

  // New topic form.
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"topic" | "certification" | "skill">("topic");
  const [newGoal, setNewGoal] = useState("");

  // Suggestions.
  const [suggestions, setSuggestions] = useState<{ name: string; kind: string; why: string }[]>([]);

  // Add-material form (inside a topic).
  const [mUrl, setMUrl] = useState("");
  const [mContent, setMContent] = useState("");

  const addTopic = async (name: string, kind: "topic" | "certification" | "skill", goal?: string) => {
    if (!name.trim()) return toast.error("Name the topic");
    await createTopic.mutateAsync({ name: name.trim(), kind, goal: goal?.trim() || undefined });
    await utils.learning.listTopics.invalidate();
    setNewName(""); setNewGoal("");
    toast.success("Topic added");
  };

  const runSuggest = async () => {
    const res = await suggest.mutateAsync();
    if (!res.success) return toast.error(res.error ?? "Failed");
    setSuggestions(res.topics);
  };

  const build = async (id: number) => {
    const t = toast.loading("Building your overview and short course…");
    const res = await buildTopic.mutateAsync({ id }).catch((e) => { toast.error(e.message, { id: t }); return null; });
    if (!res) return;
    if (!res.success) return toast.error(res.error ?? "Failed", { id: t });
    await utils.learning.listTopics.invalidate();
    toast.success("Course ready", { id: t });
  };

  // Read a screenshot into the content box via OCR, so the user does not type.
  const onScreenshot = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    if (file.size > 6_000_000) return toast.error("Image is too large (max ~6MB)");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const t = toast.loading("Reading the screenshot…");
    const res = await ocr.mutateAsync({ imageDataUrl: dataUrl }).catch((e) => { toast.error(e.message, { id: t }); return null; });
    if (!res) return;
    if (!res.success || !res.text) return toast.error(res.error ?? "Could not read the image", { id: t });
    setMContent((prev) => (prev ? prev + "\n\n" + res.text : res.text!));
    toast.success("Text pulled from the screenshot. Review, then save.", { id: t });
  };

  const runRefresh = async (id: number) => {
    const t = toast.loading("Reading your saved sources for the latest…");
    const res = await refreshLatest.mutateAsync({ id }).catch((e) => { toast.error(e.message, { id: t }); return null; });
    if (!res) return;
    if (!res.success) return toast.error(res.error ?? "Failed", { id: t });
    await utils.learning.listTopics.invalidate();
    toast.success(res.sourcesRead ? `Updated from ${res.sourcesRead} source(s).` : "Updated (no fresh sources could be read).", { id: t });
  };

  const saveMaterial = async () => {
    if (openId == null) return;
    if (!mUrl.trim() && mContent.trim().length < 10) return toast.error("Paste a link or some text");
    await addItem.mutateAsync({
      topicId: openId,
      url: mUrl.trim() || undefined,
      content: mContent.trim() || undefined,
      category: "industry",
    });
    setMUrl(""); setMContent("");
    await items.refetch();
    toast.success("Saved. Key points pulled out for you.");
  };

  return (
    <div className={embedded ? "" : "max-w-4xl"}>
      {!embedded && <h1 className="page-title">Learning &amp; Growth</h1>}
      {!embedded && <p className="page-subtitle mb-5">Build mastery in the topics that matter. Save material, get a short course, track progress.</p>}

      {/* New topic + suggestions */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Start a topic</h3>
          <span className="text-xs text-slate-400">networking, calculus, data centers, a certification…</span>
        </div>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Topic or certification name" className="input" onKeyDown={(e) => e.key === "Enter" && addTopic(newName, newKind, newGoal)} />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as never)} className="input">
            <option value="topic">Topic</option>
            <option value="skill">Skill</option>
            <option value="certification">Certification</option>
          </select>
          <button onClick={() => addTopic(newName, newKind, newGoal)} disabled={createTopic.isPending} className="btn-primary">
            {createTopic.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
        <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="What should mastering this let you do? (optional)" className="input mt-2" />
        <div className="mt-3">
          <button onClick={runSuggest} disabled={suggest.isPending} className="btn-ghost h-8 px-3 text-xs">
            {suggest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Suggest topics for my goals
          </button>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestions.map((s) => (
                <button key={s.name} onClick={() => addTopic(s.name, (s.kind as never) || "topic", s.why)} title={s.why} className="chip bg-brand-light text-brand hover:brightness-95">
                  <Plus className="w-3 h-3 mr-1" /> {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Topics grid */}
      <div className="grid sm:grid-cols-2 gap-3">
        {(topics.data as Topic[] | undefined)?.map((t) => {
          const facts = (t.keyFacts as string[] | null) ?? [];
          const modules = ((t.course as { modules?: unknown[] } | null)?.modules ?? []).length;
          return (
            <div key={t.id} className="card p-4 card-hover">
              <div className="flex items-start gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                  {t.kind === "certification" ? <GraduationCap className="w-4 h-4 text-brand" /> : <BookOpen className="w-4 h-4 text-brand" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-sm text-slate-800 truncate">{t.name}</div>
                    <span className="chip bg-slate-100 text-slate-500 capitalize">{t.kind}</span>
                  </div>
                  {t.goal && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.goal}</div>}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${t.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{t.progress}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <button onClick={() => setOpenId(t.id)} className="btn-primary h-8 px-3 text-xs">Open <ChevronRight className="w-3.5 h-3.5" /></button>
                <button onClick={() => build(t.id)} disabled={buildTopic.isPending} className="btn-ghost h-8 px-3 text-xs">{buildTopic.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {modules ? "Rebuild course" : "Build course"}</button>
                <button onClick={async () => { await updateTopic.mutateAsync({ id: t.id, pinned: !t.pinned }); await utils.learning.listTopics.invalidate(); }} className={`h-8 px-2 rounded-lg text-xs ${t.pinned ? "text-brand" : "text-slate-400 hover:text-brand"}`} title="Pin"><Pin className="w-3.5 h-3.5" /></button>
                <button onClick={async () => { if (confirm("Delete this topic and unlink its material?")) { await removeTopic.mutateAsync({ id: t.id }); await utils.learning.listTopics.invalidate(); } }} className="h-8 px-2 rounded-lg text-xs text-slate-300 hover:text-rose-500 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {facts.length > 0 && (
                <ul className="mt-2 space-y-1">{facts.slice(0, 3).map((f, i) => <li key={i} className="flex gap-2 text-xs text-slate-600"><span className="text-brand">•</span>{f}</li>)}</ul>
              )}
            </div>
          );
        })}
        {topics.data?.length === 0 && (
          <div className="card p-8 text-center sm:col-span-2">
            <GraduationCap className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-500">No topics yet. Start one above, or let the app suggest a few for your goals.</p>
          </div>
        )}
      </div>

      {/* Topic workspace */}
      {openTopic && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm" onClick={() => setOpenId(null)}>
          <div className="card m-3 sm:m-6 w-full max-w-4xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-800 truncate">{openTopic.name}</h3>
                <p className="text-xs text-slate-400 capitalize">{openTopic.kind}{openTopic.goal ? ` · ${openTopic.goal}` : ""}</p>
              </div>
              <button onClick={() => setOpenId(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Progress control */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Progress</span>
                <input type="range" min={0} max={100} step={5} value={openTopic.progress}
                  onChange={async (e) => { await updateTopic.mutateAsync({ id: openTopic.id, progress: Number(e.target.value) }); await utils.learning.listTopics.invalidate(); }}
                  className="flex-1 accent-[color:var(--brand)]" />
                <span className="text-xs text-slate-400 w-10 text-right">{openTopic.progress}%</span>
              </div>

              {/* Overview + course */}
              {openTopic.overview ? (
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Overview</div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{openTopic.overview}</p>
                  {((openTopic.keyFacts as string[] | null) ?? []).length > 0 && (
                    <ul className="mt-3 space-y-1">{((openTopic.keyFacts as string[])).map((f, i) => <li key={i} className="flex gap-2 text-xs text-slate-600"><span className="text-brand">•</span>{f}</li>)}</ul>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
                  <p className="text-sm text-slate-500 mb-2">No course yet. Build one from your saved material and general knowledge.</p>
                  <button onClick={() => build(openTopic.id)} disabled={buildTopic.isPending} className="btn-primary mx-auto">{buildTopic.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Building…</> : <><Wand2 className="w-4 h-4" /> Build short course</>}</button>
                </div>
              )}

              {(openTopic.course as { modules?: { title: string; summary: string; tasks: string[] }[] } | null)?.modules && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Short course</div>
                  {((openTopic.course as { modules: { title: string; summary: string; tasks: string[] }[] }).modules).map((m, i) => (
                    <div key={i} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="font-semibold text-sm text-slate-800">{i + 1}. {m.title}</div>
                      <p className="text-xs text-slate-500 mt-0.5">{m.summary}</p>
                      {m.tasks?.length > 0 && <ul className="mt-1.5 space-y-1">{m.tasks.map((tk, j) => <li key={j} className="flex gap-2 text-xs text-slate-600"><span className="text-brand">▸</span>{tk}</li>)}</ul>}
                    </div>
                  ))}
                </div>
              )}

              {/* Latest on this topic */}
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2"><Newspaper className="w-4 h-4 text-brand" /><h4 className="font-bold text-xs text-slate-700">Latest</h4></div>
                  <button onClick={() => runRefresh(openTopic.id)} disabled={refreshLatest.isPending} className="btn-ghost h-8 px-3 text-xs">
                    {refreshLatest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh latest
                  </button>
                </div>
                {(() => {
                  const latest = openTopic.latest as { updatedAt?: string; items?: { title: string; note: string; url?: string }[]; caveat?: string } | null;
                  if (!latest?.items?.length) {
                    return <p className="text-xs text-slate-400">No update yet. Refresh to read your saved source links for what to know now.</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {latest.updatedAt && <div className="text-[10px] text-slate-400">Updated {new Date(latest.updatedAt).toLocaleString()}</div>}
                      {latest.items.map((it, i) => (
                        <div key={i} className="text-xs">
                          <div className="font-semibold text-slate-700">{it.title}</div>
                          <div className="text-slate-500">{it.note}</div>
                          {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-brand font-semibold inline-flex items-center gap-1">Source <ExternalLink className="w-3 h-3" /></a>}
                        </div>
                      ))}
                      {latest.caveat && <p className="text-[11px] text-slate-400 italic mt-1">{latest.caveat}</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Add material */}
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center gap-2 mb-2"><Plus className="w-4 h-4 text-brand" /><h4 className="font-bold text-xs text-slate-700">Add material</h4><span className="text-[11px] text-slate-400">a link, pasted notes, or a screenshot</span></div>
                <input value={mUrl} onChange={(e) => setMUrl(e.target.value)} placeholder="Link (article, post, docs…)" className="input mb-2" />
                <textarea value={mContent} onChange={(e) => setMContent(e.target.value)} placeholder="Paste text / notes, or upload a screenshot to read it automatically…" className="textarea min-h-[90px]" />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button onClick={saveMaterial} disabled={addItem.isPending} className="btn-primary">{addItem.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Plus className="w-4 h-4" /> Save &amp; summarize</>}</button>
                  <label className={`btn-ghost cursor-pointer ${ocr.isPending ? "opacity-60 pointer-events-none" : ""}`}>
                    {ocr.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Read a screenshot
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { onScreenshot(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                  </label>
                </div>
              </div>

              {/* Saved material */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Saved material</div>
                {items.data?.map((it) => (
                  <div key={it.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="font-semibold text-sm text-slate-800 hover:text-brand truncate">{it.title}</a> : <span className="font-semibold text-sm text-slate-800 truncate">{it.title}</span>}
                      {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-brand"><ExternalLink className="w-3.5 h-3.5" /></a>}
                    </div>
                    {it.summary && <p className="text-xs text-slate-500 mt-1">{it.summary}</p>}
                    {((it.takeaways as string[]) ?? []).length > 0 && (
                      <ul className="mt-1.5 space-y-1">{((it.takeaways as string[])).map((tk, i) => <li key={i} className="flex gap-2 text-xs text-slate-600"><span className="text-brand">•</span>{tk}</li>)}</ul>
                    )}
                  </div>
                ))}
                {items.data?.length === 0 && <p className="text-xs text-slate-400">No material yet. Add a link or paste notes above.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
