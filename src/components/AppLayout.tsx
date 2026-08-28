import { NavLink, useNavigate } from "react-router";
import { useState, useEffect, useCallback, type ReactNode } from "react";
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
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";

type NavItem = { to: string; label: string; icon: React.ElementType; end?: boolean };

// Default order. Story then Demo lead so a new user meets the flow first,
// followed by the journey: set up → find → tailor & apply → grow.
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  // Intro
  { to: "/story", label: "Watch the Story", icon: Clapperboard },
  { to: "/demo", label: "Product Demo", icon: Play },
  // 1. Set up
  { to: "/profiles", label: "Profile & Portfolio", icon: User },
  { to: "/voice", label: "Voice Studio", icon: Mic },
  { to: "/resume", label: "Resume", icon: FileText },
  // 2. Find
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  // 3. Tailor & apply
  { to: "/optimizer", label: "AI Optimizer", icon: Bot },
  { to: "/applications", label: "Applications", icon: Send },
  // 4. Grow
  { to: "/growth", label: "Growth", icon: GraduationCap },
  // Reference / support
  { to: "/support", label: "Help & Support", icon: LifeBuoy },
  { to: "/billing", label: "Billing", icon: CreditCard },
];

const NAV_ORDER_KEY = "ta_nav_order";

/** Apply a saved order (array of `to` paths) to the current nav, keeping any
 *  newly added items (not in the saved order) at their default position. */
function applyOrder(items: NavItem[], order: string[] | null): NavItem[] {
  if (!order?.length) return items;
  const byTo = new Map(items.map((i) => [i.to, i]));
  const result: NavItem[] = [];
  for (const to of order) {
    const item = byTo.get(to);
    if (item) { result.push(item); byTo.delete(to); }
  }
  // Append any items not present in the saved order (e.g. new features).
  for (const item of items) if (byTo.has(item.to)) result.push(item);
  return result;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation();

  // Nav order is user-customizable via drag-and-drop and persisted locally.
  const [items, setItems] = useState<NavItem[]>(NAV);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAV_ORDER_KEY);
      if (saved) setItems(applyOrder(NAV, JSON.parse(saved)));
    } catch {
      /* ignore malformed saved order */
    }
  }, []);

  const persist = useCallback((next: NavItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next.map((i) => i.to)));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const onDrop = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  };

  const resetOrder = () => {
    try { localStorage.removeItem(NAV_ORDER_KEY); } catch { /* noop */ }
    setItems(NAV);
  };

  const isCustomized = items.map((i) => i.to).join() !== NAV.map((i) => i.to).join();

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

        <nav className="flex-1 space-y-0.5 mt-3 overflow-y-auto">
          {items.map((n, i) => (
            <div
              key={n.to}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
              onDrop={(e) => { e.preventDefault(); if (dragIndex != null) onDrop(dragIndex, i); setDragIndex(null); setOverIndex(null); }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              className={cn(
                "group relative rounded-xl transition-all",
                dragIndex === i && "opacity-40",
                overIndex === i && dragIndex !== null && dragIndex !== i && "ring-2 ring-brand/40",
              )}
            >
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 pl-3 pr-8 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-light text-brand"
                      : "text-slate-600 hover:bg-slate-50",
                  )
                }
              >
                <n.icon className="w-[18px] h-[18px] shrink-0" />
                {n.label}
              </NavLink>
              {/* Drag handle: appears on hover; the whole row is draggable. */}
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" />
              </span>
            </div>
          ))}
          {isCustomized && (
            <button
              onClick={resetOrder}
              className="flex items-center gap-2 px-3 py-2 mt-1 rounded-xl text-[11px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600 w-full transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset menu order
            </button>
          )}
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
