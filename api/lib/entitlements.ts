import { TRPCError } from "@trpc/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  TierEntitlements,
  type TierPlan,
  type SubscriptionTierType,
  type FeatureKey,
} from "../../shared/constants";
import { getDb } from "../db/client";
import { featureGrants } from "../db/schema";
import type { User } from "../db/schema";

export function tierOf(user: User): SubscriptionTierType {
  return (user.subscriptionTier as SubscriptionTierType) ?? "free";
}

/** Base plan from the user's tier (before admin grant overrides). */
export function basePlan(user: User): TierPlan {
  return TierEntitlements[tierOf(user)] ?? TierEntitlements.free;
}

/**
 * Effective entitlements = tier defaults overlaid with the user's active
 * (non-expired) admin grants. Checked live so revoked/expired grants drop.
 */
export async function effectivePlan(user: User): Promise<TierPlan> {
  const plan: TierPlan = { ...basePlan(user) };
  const now = new Date();

  const grants = await getDb()
    .select()
    .from(featureGrants)
    .where(
      and(
        eq(featureGrants.userId, user.id),
        // active = no expiry OR expiry in the future
        or(isNull(featureGrants.expiresAt), gt(featureGrants.expiresAt, now)),
      ),
    );

  for (const g of grants) {
    const key = g.feature as FeatureKey;
    if (!(key in plan)) continue;
    const bag = plan as unknown as Record<string, number | boolean>;
    if (key === "maxProfiles" || key === "dailyAutoApplyCap") {
      bag[key] = parseInt(g.value, 10) || 0;
    } else {
      bag[key] = g.value === "true";
    }
  }
  return plan;
}

/** Boolean feature check honoring tier + active grants. */
export async function hasFeature(user: User, feature: FeatureKey): Promise<boolean> {
  const plan = await effectivePlan(user);
  const v = (plan as Record<string, unknown>)[feature];
  return typeof v === "number" ? v > 0 : !!v;
}

/** Throw FORBIDDEN unless the user has the feature. */
export async function requireFeature(user: User, feature: FeatureKey, label?: string) {
  if (!(await hasFeature(user, feature))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${label ?? "This feature"} is not available on your plan. Upgrade or ask an admin for access.`,
    });
  }
}

// Backwards-compatible helpers used by existing routers.
export function entitlementsOf(user: User): TierPlan {
  return basePlan(user);
}

export async function requireAIEntitlement(user: User) {
  await requireFeature(user, "aiOptimizer", "AI optimization");
}
