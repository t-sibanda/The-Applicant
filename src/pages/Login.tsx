import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const loginMut = trpc.auth.login.useMutation();
  const registerMut = trpc.auth.register.useMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await loginMut.mutateAsync({ email, password });
      } else {
        await registerMut.mutateAsync({ email, password, displayName });
      }
      await utils.auth.me.invalidate();
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const busy = loginMut.isPending || registerMut.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold">
            The <span className="text-brand">Applicant</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">AI-Powered Job Hunt Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                mode === "login" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                mode === "register" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              Get Started
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-xs font-bold text-slate-500">Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-500">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 h-10 px-3 rounded-lg border border-slate-200 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 h-10 px-3 rounded-lg border border-slate-200 text-sm"
                placeholder="••••••••"
              />
              {mode === "register" && (
                <p className="text-[11px] text-slate-400 mt-1">
                  At least 8 characters.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-lg bg-brand text-white font-semibold disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
