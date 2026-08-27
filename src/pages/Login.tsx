import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-brand-light">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            The <span className="text-brand">Applicant</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your AI-powered job hunt companion</p>
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "login" ? "bg-white text-brand shadow-sm" : "text-slate-500"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "register" ? "bg-white text-brand shadow-sm" : "text-slate-500"
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
                  className="input mt-1"
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
                className="input mt-1"
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
                className="input mt-1"
                placeholder="••••••••"
              />
              {mode === "register" && (
                <p className="text-[11px] text-slate-400 mt-1">At least 8 characters.</p>
              )}
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          Find better jobs, tailor your resume, and land the interview.
        </p>
      </div>
    </div>
  );
}
