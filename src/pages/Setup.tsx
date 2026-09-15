import { useState } from "react";
import { User, FileText, Mic, LayoutTemplate } from "lucide-react";
import Profiles from "@/pages/Profiles";
import Portfolio from "@/pages/Portfolio";
import Resume from "@/pages/Resume";
import Voice from "@/pages/Voice";

type Tab = "targeting" | "resume" | "voice" | "portfolio";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "targeting", label: "Targeting", icon: User },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "portfolio", label: "Portfolio", icon: LayoutTemplate },
];

/**
 * Your Profile: the one place you set up who you are. Targeting, resume, voice,
 * and portfolio in a single flow so you fill it in once. Everything downstream
 * (matching, tailoring, cover letters) reads from what you save here.
 */
export default function Setup() {
  const [tab, setTab] = useState<Tab>("targeting");

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Your Profile</h1>
      <p className="page-subtitle mb-4">Set this up once. Everything you apply to is built from here.</p>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {tab === "targeting" && <Profiles embedded />}
        {tab === "resume" && <Resume embedded />}
        {tab === "voice" && <Voice embedded />}
        {tab === "portfolio" && <Portfolio embedded />}
      </div>
    </div>
  );
}
