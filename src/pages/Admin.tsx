import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Admin() {
  const utils = trpc.useUtils();
  const users = trpc.admin.listUsers.useQuery();
  const requests = trpc.admin.listSupportRequests.useQuery();
  const setStatus = trpc.admin.setUserStatus.useMutation();
  const setTier = trpc.admin.setUserTier.useMutation();
  const resolve = trpc.admin.resolveSupportRequest.useMutation();

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
    </div>
  );
}
