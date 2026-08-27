import { env } from "../lib/env";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users, subscriptions } from "../db/schema";
import { SubscriptionTier } from "../../shared/constants";

/**
 * Stripe payments, feature-flagged. When STRIPE_SECRET_KEY is absent the whole
 * module runs in "billing disabled" mode: isPaymentsEnabled() === false and no
 * Stripe calls are attempted.
 *
 * The `stripe` package is an optional dependency and imported lazily so the app
 * builds/boots even if it isn't installed.
 */

export function isPaymentsEnabled(): boolean {
  return !!env.stripe.secretKey;
}

// Map a Stripe price id to our internal tier.
function tierForPrice(priceId: string): string {
  if (priceId && priceId === env.stripe.pricePro) return SubscriptionTier.PRO;
  if (priceId && priceId === env.stripe.priceBasic)
    return SubscriptionTier.BASIC;
  return SubscriptionTier.FREE;
}

export function availablePlans() {
  const plans: Array<{ id: string; name: string; priceId: string }> = [];
  if (env.stripe.priceBasic)
    plans.push({ id: "basic", name: "Basic", priceId: env.stripe.priceBasic });
  if (env.stripe.pricePro)
    plans.push({ id: "pro", name: "Pro", priceId: env.stripe.pricePro });
  return plans;
}

async function getStripe() {
  const mod = await import("stripe").catch(() => null);
  if (!mod) return null;
  const Stripe = mod.default;
  return new Stripe(env.stripe.secretKey);
}

export async function createCheckoutSession(args: {
  userId: number;
  userEmail: string;
  planId: "basic" | "pro";
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | null> {
  if (!isPaymentsEnabled()) return null;
  const priceId =
    args.planId === "pro" ? env.stripe.pricePro : env.stripe.priceBasic;
  if (!priceId) return null;

  const stripe = await getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: args.userEmail,
    client_reference_id: String(args.userId),
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: { userId: String(args.userId) },
  });

  return session.url ? { url: session.url } : null;
}

/**
 * Verify and process a Stripe webhook. Returns true if handled.
 * Entitlement changes happen ONLY here, after signature verification.
 */
export async function handleWebhook(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  if (!isPaymentsEnabled() || !env.stripe.webhookSecret) return false;
  const stripe = await getStripe();
  if (!stripe) return false;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.stripe.webhookSecret,
    );
  } catch {
    return false; // invalid signature
  }

  const db = getDb();

  const applyTier = async (userId: number, tier: string) => {
    await db.update(users).set({ subscriptionTier: tier }).where(eq(users.id, userId));
  };

  // Resolve our user id from event metadata, or fall back to the Stripe
  // customer id we stored at checkout (subscription events lack our metadata).
  const resolveUserId = async (
    metaUserId?: string | null,
    customerId?: string | null,
  ): Promise<number | null> => {
    const fromMeta = Number(metaUserId);
    if (fromMeta) return fromMeta;
    if (customerId) {
      const rows = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId))
        .limit(1);
      if (rows[0]) return rows[0].userId;
    }
    return null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as {
        client_reference_id?: string | null;
        customer?: string | null;
        subscription?: string | null;
        metadata?: Record<string, string> | null;
      };
      const userId = Number(s.client_reference_id ?? s.metadata?.userId);
      if (userId) {
        // On first checkout we grant at least Basic; the subscription.updated
        // event will refine the exact tier from the price.
        await applyTier(userId, SubscriptionTier.BASIC);
        await db.insert(subscriptions).values({
          userId,
          stripeCustomerId: s.customer ?? undefined,
          stripeSubId: s.subscription ?? undefined,
          status: "active",
        });
      }
      return true;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as {
        metadata?: Record<string, string> | null;
        customer?: string | null;
        items?: { data?: Array<{ price?: { id?: string } }> };
        status?: string;
      };
      const userId = await resolveUserId(sub.metadata?.userId, sub.customer);
      const priceId = sub.items?.data?.[0]?.price?.id ?? "";
      if (userId) {
        // Active/trialing → tier from price; past_due/unpaid/canceled → free.
        const active = sub.status === "active" || sub.status === "trialing";
        await applyTier(userId, active ? tierForPrice(priceId) : SubscriptionTier.FREE);
        await db
          .update(subscriptions)
          .set({ status: sub.status, plan: tierForPrice(priceId) })
          .where(eq(subscriptions.userId, userId));
      }
      return true;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as {
        metadata?: Record<string, string> | null;
        customer?: string | null;
      };
      const userId = await resolveUserId(sub.metadata?.userId, sub.customer);
      if (userId) {
        await applyTier(userId, SubscriptionTier.FREE);
        await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.userId, userId));
      }
      return true;
    }
    default:
      return true; // acknowledged, no action
  }
}
