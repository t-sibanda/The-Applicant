import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  User, Lock, CreditCard, Download, Trash2, Loader2, Save, ShieldAlert,
} from "lucide-react";

export default function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const updateAccount = trpc.auth.updateAccount.useMutation();
  const changePassword = trpc.auth.changePassword.useMutation();
  const deleteAccount = trpc.auth.deleteAccount.useMutation();
  const access = trpc.auth.myAccess.useQuery();
  const exportData = trpc.auth.exportData.useQuery(undefined, { enabled: false });

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [delPw, setDelPw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) { setDisplayName(user.name ?? ""); setEmail(user.email ?? ""); }
  }, [user?.id]);

  const saveProfile = async () => {
    try {
      await updateAccount.mutateAsync({ displayName, email });
      await utils.auth.me.invalidate();
      toast.success("Account updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const savePassword = async () => {
    if (newPw.length < 8) return toast.error("New password must be 8+ characters");
    try {
      await changePassword.mutateAsync({ currentPassword: curPw, newPassword: newPw });
      setCurPw(""); setNewPw("");
      toast.success("Password changed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const doExport = async () => {
    const res = await exportData.refetch();
    if (!res.data) return toast.error("Export failed");
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "the-applicant-data-export.json";
    a.click();
    toast.success("Your data was exported");
  };

  const doDelete = async () => {
    if (!delPw) return toast.error("Enter your password to confirm");
    try {
      await deleteAccount.mutateAsync({ password: delPw });
      await utils.auth.me.invalidate();
      toast.success("Account deleted");
      navigate("/login");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="page-title">Account Settings</h1>
      <p className="page-subtitle mb-5">Manage your profile, security, subscription, and data.</p>

      {/* Profile */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3"><User className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Profile</h3></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs font-bold text-slate-500">Display name</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input mt-1" /></div>
          <div><label className="text-xs font-bold text-slate-500">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" /></div>
        </div>
        <button onClick={saveProfile} disabled={updateAccount.isPending} className="btn-primary mt-3">
          {updateAccount.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
        </button>
      </div>

      {/* Password */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3"><Lock className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Password</h3></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs font-bold text-slate-500">Current password</label><input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className="input mt-1" /></div>
          <div><label className="text-xs font-bold text-slate-500">New password</label><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input mt-1" placeholder="8+ characters" /></div>
        </div>
        <button onClick={savePassword} disabled={changePassword.isPending || !curPw || !newPw} className="btn-ghost mt-3">
          {changePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Change password
        </button>
      </div>

      {/* Subscription */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Subscription</h3></div>
        <p className="text-sm text-slate-600">Current plan: <span className="font-semibold capitalize">{access.data?.tier ?? "—"}</span></p>
        <Link to="/billing" className="btn-ghost mt-3"><CreditCard className="w-4 h-4" /> Manage plan</Link>
      </div>

      {/* Data */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-2"><Download className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Your data</h3></div>
        <p className="text-xs text-slate-500 mb-3">Download a copy of everything you've stored — profiles, resumes, jobs, applications, and saved items.</p>
        <button onClick={doExport} disabled={exportData.isFetching} className="btn-ghost">
          {exportData.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export my data (JSON)
        </button>
      </div>

      {/* Danger zone */}
      <div className="card p-5 border-rose-200">
        <div className="flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-rose-500" /><h3 className="font-bold text-sm text-rose-600">Delete account</h3></div>
        <p className="text-xs text-slate-500 mb-3">Permanently deletes your account and all associated data. This cannot be undone.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50"><Trash2 className="w-4 h-4" /> Delete my account</button>
        ) : (
          <div className="flex gap-2 flex-wrap items-center">
            <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} className="input max-w-[220px]" placeholder="Enter password to confirm" />
            <button onClick={doDelete} disabled={deleteAccount.isPending} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">
              {deleteAccount.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Permanently delete
            </button>
            <button onClick={() => { setConfirmDelete(false); setDelPw(""); }} className="btn-ghost">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
