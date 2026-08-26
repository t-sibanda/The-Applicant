import { TRPCError } from "@trpc/server";
import {
  TierEntitlements,
  type SubscriptionTierType,
} from "../../shared/constants";
import type { User } from "../db/schema";

export function tierOf(user: User): SubscriptionTierType {
  return (user.subscriptionTier as SubscriptionTierType) ?? "free";
}

export function entitlementsOf(user: User) {
  return TierEntitlements[tierOf(user)] ?? TierEntitlements.free;
}

/** Throw FORBIDDEN if the user's plan doesn't include the AI optimizer. */
export function requireAIEntitlement(user: User) {
  if (!entitlementsOf(user).aiOptimizer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "AI optimization is a paid feature. Upgrade your plan to use it.",
    });
  }
}
