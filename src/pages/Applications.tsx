import { trpc } from "@/lib/trpc";

const STATUSES = ["saved", "applied", "phone_screen", "interview", "offer", "rejected"];

export default function Applications() {
  const utils = trpc.useUtils();
  const apps = trpc.applications.list.useQuery();
  const updateStatus = trpc.applications.updateStatus.useMutation();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Applications</h1>
      <p className="text-sm text-slate-500 mb-5">Track your pipeline.</p>

      <div className="space-y-2">
        {apps.data?.map((a) => (
          <div key={a.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold text-sm">{a.companyName ?? "Application"}</div>
              <div className="text-xs text-slate-500">{new Date(a.createdAt ?? Date.now()).toLocaleDateString()}</div>
            </div>
            <select
              value={a.status}
              onChange={async (e) => {
                await updateStatus.mutateAsync({ id: a.id, status: e.target.value as never });
                await utils.applications.list.invalidate();
              }}
              className="h-9 px-2 rounded-lg border border-slate-200 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        ))}
        {apps.data?.length === 0 && (
          <p className="text-sm text-slate-400">No applications logged yet.</p>
        )}
      </div>
    </div>
  );
}
