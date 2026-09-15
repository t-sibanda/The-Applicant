import { useState } from "react";
import { Link } from "react-router";
import { Bell, ExternalLink, Check, Briefcase } from "lucide-react";
import { trpc } from "@/lib/trpc";

type MatchTop = {
  title: string;
  company: string;
  relevance: number;
  url?: string;
  applyChannel?: { channel: "company_page" | "job_board"; note: string };
};

/**
 * A lightweight notification bell. Shows unread count and, for job-match
 * notifications, the top strong-fit roles with an honest match score and
 * apply-channel guidance (company page vs job board). No fabricated odds.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const list = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 60_000, // gently poll so new matches surface
  });
  const utils = trpc.useUtils();
  const markRead = trpc.notifications.markRead.useMutation();
  const markAll = trpc.notifications.markAllRead.useMutation();

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  const relColor = (r: number) => (r >= 85 ? "text-emerald-600" : "text-brand");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full bg-white/90 shadow-card flex items-center justify-center text-slate-500 hover:text-brand transition-colors"
        title="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto card z-50 p-0">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
              <span className="font-bold text-sm text-slate-800">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={async () => { await markAll.mutateAsync(); await utils.notifications.list.invalidate(); }}
                  className="text-[11px] font-semibold text-brand hover:underline inline-flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            {items.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">
                No notifications yet. Run a job search and strong matches will show up here.
              </div>
            )}

            <div className="divide-y divide-[var(--border)]">
              {items.map((n) => {
                const payload = (n.payload as { count?: number; top?: MatchTop[] } | null) ?? {};
                const isMatch = n.type === "job_match";
                return (
                  <div
                    key={n.id}
                    className={`p-3 ${n.read ? "" : "bg-brand-light/40"}`}
                    onMouseEnter={async () => { if (!n.read) { await markRead.mutateAsync({ id: n.id }); await utils.notifications.list.invalidate(); } }}
                  >
                    {isMatch ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-brand" />
                          <span className="text-xs font-bold text-slate-700">
                            {payload.count ?? payload.top?.length ?? 0} strong match{(payload.count ?? 1) === 1 ? "" : "es"} found
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {(payload.top ?? []).map((m, i) => (
                            <div key={i} className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold ${relColor(m.relevance)}`}>{m.relevance}%</span>
                                <span className="text-slate-700 truncate">{m.title}</span>
                              </div>
                              <div className="text-slate-400">{m.company}</div>
                              {m.applyChannel && (
                                <div className="text-[11px] text-slate-500 mt-0.5">{m.applyChannel.note}</div>
                              )}
                              {m.url && (
                                <a href={m.url} target="_blank" rel="noreferrer" className="text-[11px] text-brand font-semibold inline-flex items-center gap-1 mt-0.5">
                                  View posting <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                        <Link to="/jobs" onClick={() => setOpen(false)} className="text-[11px] text-brand font-semibold hover:underline mt-2 inline-block">
                          Open Find &amp; Apply
                        </Link>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">{JSON.stringify(n.payload)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
