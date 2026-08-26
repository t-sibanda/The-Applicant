import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Billing</h1>
      <p className="text-sm text-slate-500 mb-5">
        Current plan: <span className="font-semibold">{status.data?.currentTier ?? "—"}</span>
      </p>

      {!status.data?.enabled ? (
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-sm text-slate-500">
          Billing is not configured on this deployment. Add Stripe keys and price IDs to enable paid plans.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {status.data.plans.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="font-bold text-lg capitalize">{p.name}</div>
              <p className="text-xs text-slate-500 mt-1 mb-4">Full AI optimizer, job search, and more.</p>
              <button
                onClick={() => buy(p.id as "basic" | "pro")}
                disabled={checkout.isPending}
                className="w-full h-10 rounded-lg bg-brand text-white text-sm font-semibold"
              >
                Subscribe
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
