import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Profiles() {
  const utils = trpc.useUtils();
  const profiles = trpc.profiles.list.useQuery();
  const create = trpc.profiles.create.useMutation();
  const setActive = trpc.profiles.setActive.useMutation();
  const del = trpc.profiles.delete.useMutation();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");

  const refresh = () => utils.profiles.list.invalidate();

  const add = async () => {
    if (!name.trim()) return toast.error("Give the profile a name");
    try {
      await create.mutateAsync({
        name,
        targetIndustry: industry || undefined,
        targetRole: role || undefined,
      });
      setName(""); setIndustry(""); setRole("");
      await refresh();
      toast.success("Profile created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Profiles</h1>
      <p className="text-sm text-slate-500 mb-5">
        Create separate targeting profiles per industry or role. One is active at a time.
      </p>

      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 grid sm:grid-cols-4 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Target role" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
        <button onClick={add} disabled={create.isPending} className="h-10 rounded-lg bg-brand text-white text-sm font-semibold">Add</button>
      </div>

      <div className="space-y-2">
        {profiles.data?.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {p.name}{" "}
                {p.isActive && <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full ml-1">active</span>}
              </div>
              <div className="text-xs text-slate-500">
                {[p.targetRole, p.targetIndustry].filter(Boolean).join(" · ") || "No targeting set"}
              </div>
            </div>
            {!p.isActive && (
              <button onClick={async () => { await setActive.mutateAsync({ id: p.id }); await refresh(); }} className="text-xs font-semibold text-brand">Set active</button>
            )}
            <button onClick={async () => { await del.mutateAsync({ id: p.id }); await refresh(); }} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
          </div>
        ))}
        {profiles.data?.length === 0 && (
          <p className="text-sm text-slate-400">No profiles yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
