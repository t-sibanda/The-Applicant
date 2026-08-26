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
  { to: "/applications", label: "Applications", icon: Send },
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

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-white border-r border-slate-100 flex flex-col p-3">
        <div className="px-2 py-3">
          <span className="font-extrabold text-lg">
            The <span className="text-brand">Applicant</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 mt-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <Shield className="w-4 h-4" />
              Admin
            </NavLink>
          )}
        </nav>
        <div className="border-t border-slate-100 pt-2">
          <div className="px-3 py-1 text-xs text-slate-400 truncate">
            {user?.email}
          </div>
          <button
            onClick={doLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
