import { NavLink, useNavigate } from "react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Bot,
  Send,
  CreditCard,
  Shield,
  LogOut,
  LifeBuoy,
  Sparkles,
  GraduationCap,
  Mic,
  Play,
  Clapperboard,
  Eraser,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";
import { clearWorkingSession, useWorkingSession } from "@/lib/workingSession";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: React.ElementType; end?: boolean };
type NavSection = { label: string; hint: string; items: NavItem[] };

// The nav mirrors the job-hunt journey as three stages:
//   1. PREPARE — who you are (profile, voice, resume)
//   2. APPLY   — find roles and tailor applications
//   3. ADVANCE — track outcomes and grow
// Section order is deliberate; the flow is the product.
const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    hint: "",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Prepare",
    hint: "Set up once",
    items: [
      { to: "/profiles", label: "Profile & Portfolio", icon: User },
      { to: "/voice", label: "Voice Studio", icon: Mic },
      { to: "/resume", label: "Resume", icon: FileText },
    ],
  },
  {
    label: "Apply",
    hint: "Repeat per role",
    items: [
      { to: "/jobs", label: "Jobs", icon: Briefcase },
      { to: "/optimizer", label: "AI Optimizer", icon: Bot },
    ],
  },
  {
    label: "Advance",
    hint: "Track & grow",
    items: [
      { to: "/applications", label: "Applications", icon: Send },
      { to: "/growth", label: "Career & Learning", icon: GraduationCap },
    ],
  },
  {
    label: "Resources",
    hint: "",
    items: [
      { to: "/story", label: "Watch the Story", icon: Clapperboard },
      { to: "/demo", label: "Product Demo", icon: Play },
      { to: "/support", label: "Help & Support", icon: LifeBuoy },
      { to: "/billing", label: "Billing", icon: CreditCard },
    ],
  },
];

function NavRow({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-light text-brand"
            : "text-slate-600 hover:bg-slate-50",
        )
      }
    >
      <item.icon className="w-[18px] h-[18px] shrink-0" />
      {item.label}
    </NavLink>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation();

  const doLogout = async () => {
    await logout.mutateAsync();
    await utils.auth.me.invalidate();
    navigate("/login");
  };

  const tier = user?.subscriptionTier ?? "free";

  // Global clear: wipes the current working job/session from the client only.
  // It never deletes saved resumes, samples, applications, or profile data.
  const session = useWorkingSession();
  const clearSession = () => {
    if (!window.confirm("Clear your current working session? This clears the job you are working on and its drafts from this device. Your saved resumes, samples, applications, and profile are not affected. This cannot be undone.")) return;
    clearWorkingSession();
    toast.success("Working session cleared.");
  };

  return (
    <div className="min-h-screen flex relative z-10">
      <aside className="w-60 bg-white/80 backdrop-blur-xl border-r border-white/40 flex flex-col p-3 sticky top-0 h-screen shadow-[1px_0_20px_rgba(15,23,42,0.06)]">
        <div className="px-2 py-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-[15px] tracking-tight">
            The <span className="text-brand">Applicant</span>
          </span>
        </div>

        <nav className="flex-1 mt-2 overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label || "top"} className={si > 0 ? "mt-4" : ""}>
              {section.label && (
                <div className="flex items-baseline justify-between px-3 pb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                    {si}. {section.label}
                  </span>
                  {section.hint && (
                    <span className="text-[9px] font-medium text-slate-300">{section.hint}</span>
                  )}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavRow key={item.to} item={item} />
                ))}
              </div>
            </div>
          ))}
          {isAdmin && (
            <div className="mt-4">
              <div className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Admin
              </div>
              <NavRow item={{ to: "/admin", label: "Console", icon: Shield }} />
            </div>
          )}
        </nav>

        <div className="border-t border-[var(--border)] pt-3 mt-2">
          {session && (
            <button
              onClick={clearSession}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 w-full transition-colors"
              title="Clear the job you are working on. Saved data is kept."
            >
              <Eraser className="w-[18px] h-[18px]" />
              Clear working session
            </button>
          )}
          <NavLink to="/account" className="block px-3 pb-2 rounded-xl hover:bg-slate-50 py-1">
            <div className="text-xs font-semibold text-slate-700 truncate">
              {user?.name || user?.email}
            </div>
            <div className="text-[10px] text-slate-400">Account settings</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  "chip capitalize",
                  tier === "pro"
                    ? "bg-violet-100 text-violet-700"
                    : tier === "basic"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                )}
              >
                {tier} plan
              </span>
            </div>
          </NavLink>
          <button
            onClick={doLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 w-full transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="page-canvas min-h-[calc(100vh-3rem)] rounded-3xl p-6 md:p-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
