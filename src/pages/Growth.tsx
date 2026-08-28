import { useState } from "react";
import { GraduationCap, BookOpen } from "lucide-react";
import Career from "@/pages/Career";
import Learning from "@/pages/Learning";

/**
 * Growth combines the Career Builder and Learning Center into one page with
 * tabs, so planning your path and collecting what you learn live together.
 */
export default function Growth() {
  const [tab, setTab] = useState<"career" | "learning">("career");

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">Growth</h1>
      <p className="page-subtitle mb-4">Plan your path and keep what you learn, in one place.</p>

      <div className="flex gap-1.5 mb-5">
        <button
          onClick={() => setTab("career")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "career" ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
        >
          <GraduationCap className="w-4 h-4" /> Career Builder
        </button>
        <button
          onClick={() => setTab("learning")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "learning" ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
        >
          <BookOpen className="w-4 h-4" /> Learning Center
        </button>
      </div>

      {/* Each sub-view keeps its own logic; we just switch which is mounted. */}
      <div className="animate-fade-in">
        {tab === "career" ? <Career embedded /> : <Learning embedded />}
      </div>
    </div>
  );
}
