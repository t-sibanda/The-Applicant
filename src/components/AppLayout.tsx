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
  LayoutTemplate,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/profiles", label: "Profiles", icon: User },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/optimizer", label: "AI Optimizer", icon: Bot },
  { to: "/portfolio", label: "Portfolio", icon: LayoutTemplate },
  { to: "/career", label: "Career Builder", icon: GraduationCap },
  { to: "/learning", label: "Learning Center", icon: BookOpen },
  { to: "/applications", label: "Applications", icon: Send },
  { to: "/support", label: "Help & Support", icon: LifeBuoy },
  { to: "/billing", label: "Billing", icon: CreditCard },
];

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

        <nav className="flex-1 space-y-0.5 mt-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-light text-brand"
                    : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <n.icon className="w-[18px] h-[18px]" />
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-light text-brand"
                    : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <Shield className="w-[18px] h-[18px]" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="border-t border-[var(--border)] pt-3 mt-2">
          <div className="px-3 pb-2">
            <div className="text-xs font-semibold text-slate-700 truncate">
              {user?.name || user?.email}
            </div>
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
          </div>
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
