import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check, Sparkles, Loader2 } from "lucide-react";

const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    "AI resume tailoring",
    "AI cover letters",
    "ATS compatibility scoring",
    "Up to 3 profiles",
    "AI career coach",
  ],
  pro: [
    "Everything in Basic",
    "Up to 25 profiles",
    "Skill gap analysis",
    "Voice profile personalization",
    "Priority AI processing",
  ],
};

export default function Billing() {
  const status = trpc.billing.status.useQuery();
  const checkout = trpc.billing.createCheckout.useMutation();

  const buy = async (planId: "basic" | "pro") => {
    try {
      const res = await checkout.mutateAsync({
        planId,
        successUrl: `${window.location.origin}/billing?success=1`,
        cancelUrl: `${window.location.origin}/billing?canceled=1`,
      });
      window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    }
  };

  const currentTier = status.data?.currentTier ?? "free";

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Billing &amp; Plans</h1>
      <p className="page-subtitle mb-5">
        You're on the <span className="font-semibold capitalize text-slate-700">{currentTier}</span> plan.
      </p>

      {!status.data?.enabled ? (
        <div className="card p-6 text-sm text-slate-500">
          Billing isn't configured on this deployment yet. Once Stripe products and
          the webhook are set up, plans will appear here for self-service upgrades.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {status.data.plans.map((p) => {
            const isCurrent = currentTier === p.id;
            return (
              <div key={p.id} className={`card p-6 ${p.id === "pro" ? "ring-2 ring-brand/30" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-lg capitalize">{p.name}</div>
                  {p.id === "pro" && <span className="chip bg-brand-light text-brand">Most popular</span>}
                </div>
                <ul className="space-y-2 my-4">
                  {(PLAN_FEATURES[p.id] ?? []).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => buy(p.id as "basic" | "pro")}
                  disabled={checkout.isPending || isCurrent}
                  className="btn-primary w-full"
                >
                  {isCurrent ? "Current plan" : checkout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Subscribe</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
