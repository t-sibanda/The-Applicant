import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shield, X } from "lucide-react";

const BOOL_FEATURES = [
  { key: "aiOptimizer", label: "AI Optimizer" },
  { key: "semiApply", label: "Assisted apply" },
  { key: "autoApply", label: "Auto-apply" },
  { key: "portfolio", label: "Portfolio" },
  { key: "career", label: "Career Builder" },
  { key: "learning", label: "Learning" },
  { key: "jobSearch", label: "Job search" },
] as const;

function AccessEditor({ userId, onClose }: { userId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const access = trpc.admin.getUserAccess.useQuery({ userId });
  const grant = trpc.admin.grantFeature.useMutation();
  const revoke = trpc.admin.revokeFeature.useMutation();
  const [days, setDays] = useState(0); // 0 = permanent

  const plan = access.data?.plan as Record<string, boolean | number> | undefined;
  const grants = access.data?.grants ?? [];

  const expiryIso = () => (days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : undefined);
  const grantOf = (f: string) => grants.find((g) => g.feature === f);

  const toggle = async (feature: string, value: boolean) => {
    await grant.mutateAsync({ userId, feature: feature as never, value: String(value), expiresAt: expiryIso() });
    await utils.admin.getUserAccess.invalidate({ userId });
    toast.success(`${value ? "Granted" : "Blocked"} ${feature}${days > 0 ? ` for ${days} days` : ""}`);
  };
  const clearGrant = async (feature: string) => {
    await revoke.mutateAsync({ userId, feature: feature as never });
    await utils.admin.getUserAccess.invalidate({ userId });
    toast.success("Reset to tier default");
  };
  const setCap = async (v: number) => {
    await grant.mutateAsync({ userId, feature: "dailyAutoApplyCap" as never, value: String(v), expiresAt: expiryIso() });
    await utils.admin.getUserAccess.invalidate({ userId });
    toast.success(`Auto-apply cap set to ${v}/day`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Access control</h3></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Grant duration:</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-[var(--border)] text-xs">
              <option value={0}>Permanent</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          {BOOL_FEATURES.map((f) => {
            const g = grantOf(f.key);
            const effective = !!plan?.[f.key];
            return (
              <div key={f.key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-700">{f.label}</div>
                  <div className="text-[11px] text-slate-400">
                    {effective ? "Enabled" : "Disabled"}
                    {g && <span> · override{g.expiresAt ? ` until ${new Date(g.expiresAt).toLocaleDateString()}` : " (permanent)"}</span>}
                  </div>
                </div>
                <button onClick={() => toggle(f.key, true)} className="text-xs font-semibold text-emerald-600 hover:underline">Grant</button>
                <button onClick={() => toggle(f.key, false)} className="text-xs font-semibold text-rose-500 hover:underline">Block</button>
                {g && <button onClick={() => clearGrant(f.key)} className="text-xs text-slate-400 hover:underline">Reset</button>}
              </div>
            );
          })}
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-700">Auto-apply daily cap</div>
              <div className="text-[11px] text-slate-400">Currently {String(plan?.dailyAutoApplyCap ?? 0)}/day</div>
            </div>
            {[0, 5, 10, 20].map((v) => <button key={v} onClick={() => setCap(v)} className="text-xs font-semibold text-brand hover:underline">{v}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const utils = trpc.useUtils();
  const users = trpc.admin.listUsers.useQuery();
  const requests = trpc.admin.listSupportRequests.useQuery();
  const setStatus = trpc.admin.setUserStatus.useMutation();
  const setTier = trpc.admin.setUserTier.useMutation();
  const resolve = trpc.admin.resolveSupportRequest.useMutation();
  const [accessUserId, setAccessUserId] = useState<number | null>(null);

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold mb-1">Admin Console</h1>
      <p className="text-sm text-slate-500 mb-5">Manage accounts and support requests.</p>

      <h2 className="text-sm font-bold text-slate-700 mb-2">Users</h2>
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Tier</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.status}</td>
                <td className="p-3">{u.subscriptionTier}</td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={async () => {
                      await setStatus.mutateAsync({ userId: u.id, status: u.status === "active" ? "suspended" : "active" });
                      await utils.admin.listUsers.invalidate();
                    }}
                    className="text-xs font-semibold text-brand"
                  >
                    {u.status === "active" ? "Suspend" : "Reactivate"}
                  </button>
                  <select
                    value={u.subscriptionTier}
                    onChange={async (e) => {
                      await setTier.mutateAsync({ userId: u.id, tier: e.target.value as never });
                      await utils.admin.listUsers.invalidate();
                    }}
                    className="text-xs border border-slate-200 rounded px-1"
                  >
                    <option value="free">free</option>
                    <option value="basic">basic</option>
                    <option value="pro">pro</option>
                  </select>
                  <button onClick={() => setAccessUserId(u.id)} className="text-xs font-semibold text-brand hover:underline">Access</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-bold text-slate-700 mb-2">Support requests</h2>
      <div className="space-y-2">
        {requests.data?.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold text-sm">{r.subject}</div>
              <div className="text-xs text-slate-500">{r.message}</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{r.status}</span>
            {r.status === "open" && (
              <button onClick={async () => { await resolve.mutateAsync({ id: r.id }); await utils.admin.listSupportRequests.invalidate(); toast.success("Resolved"); }} className="text-xs font-semibold text-brand">Resolve</button>
            )}
          </div>
        ))}
        {requests.data?.length === 0 && <p className="text-sm text-slate-400">No support requests.</p>}
      </div>

      {accessUserId != null && <AccessEditor userId={accessUserId} onClose={() => setAccessUserId(null)} />}
    </div>
  );
}
