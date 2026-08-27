import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, Save, Loader2, Eye, Palette, LayoutTemplate, Plus, X } from "lucide-react";

const TEMPLATES = [
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
  { id: "elegant", label: "Elegant" },
] as const;

const ACCENTS = ["#ff6b35", "#7c3aed", "#0ea5e9", "#10b981", "#e11d48", "#0f172a"];

export default function Portfolio() {
  const utils = trpc.useUtils();
  const data = trpc.portfolio.get.useQuery();
  const upsert = trpc.portfolio.upsert.useMutation();
  const generate = trpc.portfolio.generateAbout.useMutation();

  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [accomplishments, setAccomplishments] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("modern");
  const [accent, setAccent] = useState("#ff6b35");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (data.data) {
      setHeadline(data.data.headline ?? "");
      setAbout(data.data.about ?? "");
      setAccomplishments((data.data.accomplishments as string[]) ?? []);
      setSkills((data.data.skills as string[]) ?? []);
      setLinks((data.data.links as { label: string; url: string }[]) ?? []);
      setTemplate((data.data.template as never) ?? "modern");
      setAccent(data.data.accent ?? "#ff6b35");
    }
  }, [data.data?.id]);

  const save = async () => {
    await upsert.mutateAsync({ headline, about, accomplishments, skills, links, template, accent });
    await utils.portfolio.get.invalidate();
    toast.success("Portfolio saved");
  };

  const aiGenerate = async () => {
    const res = await generate.mutateAsync();
    if (!res.success) return toast.error(res.error ?? "Failed");
    const d = res.data as { headline?: string; about?: string; accomplishments?: string[]; skills?: string[] };
    if (d.headline) setHeadline(d.headline);
    if (d.about) setAbout(d.about);
    if (d.accomplishments) setAccomplishments(d.accomplishments);
    if (d.skills) setSkills(d.skills);
    toast.success("Generated in your voice — edit anything you like");
  };

  if (preview) {
    return (
      <PortfolioPreview
        headline={headline} about={about} accomplishments={accomplishments}
        skills={skills} links={links} template={template} accent={accent}
        onBack={() => setPreview(false)}
      />
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Portfolio Builder</h1>
        <div className="flex gap-2">
          <button onClick={() => setPreview(true)} className="btn-ghost"><Eye className="w-4 h-4" /> Preview</button>
          <button onClick={save} disabled={upsert.isPending} className="btn-primary">
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>
      <p className="page-subtitle mb-5">Build an interactive portfolio that markets you — in your voice.</p>

      {/* AI generate */}
      <div className="card p-4 mb-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#ede9fe,#fff)" }}>
        <Sparkles className="w-5 h-5 text-brand shrink-0" />
        <div className="flex-1 text-sm text-slate-600">Let AI draft your headline, about, and highlights from your resume — in your voice.</div>
        <button onClick={aiGenerate} disabled={generate.isPending} className="btn-primary shrink-0">
          {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate
        </button>
      </div>

      {/* Style controls */}
      <div className="card p-4 mb-4 grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2"><LayoutTemplate className="w-3.5 h-3.5" /> Template</div>
          <div className="flex gap-2 flex-wrap">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setTemplate(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${template === t.id ? "border-brand text-brand bg-brand-light" : "border-slate-100 text-slate-500"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2"><Palette className="w-3.5 h-3.5" /> Accent</div>
          <div className="flex gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAccent(c)} className={`w-7 h-7 rounded-full transition-transform ${accent === c ? "ring-2 ring-offset-2 ring-slate-300 scale-110" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Content editor */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500">Headline</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="input mt-1" placeholder="e.g. Mechanical Engineer specializing in data-center cooling" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">About</label>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} className="textarea mt-1 min-h-[120px]" placeholder="A short, compelling intro in your voice…" />
        </div>
        <EditableList label="Accomplishments" items={accomplishments} setItems={setAccomplishments} placeholder="Add an achievement…" />
        <EditableList label="Skills" items={skills} setItems={setSkills} placeholder="Add a skill…" chips />
        <LinkList links={links} setLinks={setLinks} />
      </div>
    </div>
  );
}

function EditableList({ label, items, setItems, placeholder, chips }: { label: string; items: string[]; setItems: (v: string[]) => void; placeholder: string; chips?: boolean }) {
  const [val, setVal] = useState("");
  const add = () => { if (val.trim()) { setItems([...items, val.trim()]); setVal(""); } };
  return (
    <div>
      <label className="text-xs font-bold text-slate-500">{label}</label>
      <div className="flex gap-2 mt-1">
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="input flex-1" placeholder={placeholder} />
        <button onClick={add} className="btn-ghost px-3"><Plus className="w-4 h-4" /></button>
      </div>
      <div className={chips ? "flex flex-wrap gap-2 mt-2" : "space-y-1.5 mt-2"}>
        {items.map((it, i) => chips ? (
          <span key={i} className="chip bg-slate-100 text-slate-600">{it}<button onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="w-3 h-3 ml-1" /></button></span>
        ) : (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
            <span className="flex-1">{it}</span>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkList({ links, setLinks }: { links: { label: string; url: string }[]; setLinks: (v: { label: string; url: string }[]) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const add = () => { if (url.trim()) { setLinks([...links, { label: label || url, url }]); setLabel(""); setUrl(""); } };
  return (
    <div>
      <label className="text-xs font-bold text-slate-500">Links</label>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mt-1">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="Label (LinkedIn)" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder="https://…" />
        <button onClick={add} className="btn-ghost px-3"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {links.map((l, i) => (
          <span key={i} className="chip bg-slate-100 text-slate-600">{l.label}<button onClick={() => setLinks(links.filter((_, j) => j !== i))}><X className="w-3 h-3 ml-1" /></button></span>
        ))}
      </div>
    </div>
  );
}

function PortfolioPreview({ headline, about, accomplishments, skills, links, template, accent, onBack }: any) {
  const isBold = template === "bold";
  const isMinimal = template === "minimal";
  const isElegant = template === "elegant";
  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="btn-ghost mb-4">← Back to editor</button>
      <div className="card overflow-hidden print:shadow-none">
        <div className="p-8" style={{ background: isMinimal ? "#fff" : `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: isMinimal ? "#0f172a" : "#fff" }}>
          <h1 className={`font-display font-extrabold ${isBold ? "text-4xl" : "text-3xl"}`} style={{ color: isMinimal ? accent : "#fff" }}>{headline || "Your headline"}</h1>
        </div>
        <div className="p-8 space-y-6">
          {about && <p className={`text-slate-600 leading-relaxed ${isElegant ? "text-lg font-light" : ""} whitespace-pre-wrap`}>{about}</p>}
          {accomplishments?.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>Highlights</h2>
              <ul className="space-y-1.5">{accomplishments.map((a: string, i: number) => <li key={i} className="flex gap-2 text-sm text-slate-700"><span style={{ color: accent }}>▸</span>{a}</li>)}</ul>
            </div>
          )}
          {skills?.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>Skills</h2>
              <div className="flex flex-wrap gap-2">{skills.map((s: string, i: number) => <span key={i} className="chip" style={{ background: `${accent}18`, color: accent }}>{s}</span>)}</div>
            </div>
          )}
          {links?.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">{links.map((l: any, i: number) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-sm font-semibold" style={{ color: accent }}>{l.label} ↗</a>)}</div>
          )}
        </div>
      </div>
      <button onClick={() => window.print()} className="btn-ghost mt-4">Print / Save as PDF</button>
    </div>
  );
}
