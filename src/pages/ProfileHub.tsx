import { useState } from "react";
import { User, LayoutTemplate } from "lucide-react";
import Profiles from "@/pages/Profiles";
import Portfolio from "@/pages/Portfolio";

/**
 * ProfileHub combines your Profile (targeting, resume, voice, saved items) and
 * your Portfolio builder into one page with tabs.
 */
export default function ProfileHub() {
  const [tab, setTab] = useState<"profile" | "portfolio">("profile");

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">Profile</h1>
      <p className="page-subtitle mb-4">Your targeting and assets, plus the portfolio you show off.</p>

      <div className="flex gap-1.5 mb-5">
        <button
          onClick={() => setTab("profile")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "profile" ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
        >
          <User className="w-4 h-4" /> Profile & Resume
        </button>
        <button
          onClick={() => setTab("portfolio")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "portfolio" ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
        >
          <LayoutTemplate className="w-4 h-4" /> Portfolio
        </button>
      </div>

      <div className="animate-fade-in">
        {tab === "profile" ? <Profiles embedded /> : <Portfolio embedded />}
      </div>
    </div>
  );
}
