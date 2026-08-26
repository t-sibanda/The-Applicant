// Shared constants used by both client and server.

export const SESSION_COOKIE = "ta_session";

export const Roles = {
  USER: "user",
  ADMIN: "admin",
} as const;
export type Role = (typeof Roles)[keyof typeof Roles];

export const UserStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;
export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];

export const SubscriptionTier = {
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
} as const;
export type SubscriptionTierType =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const JobStatus = {
  NEW: "new",
  SAVED: "saved",
  APPLIED: "applied",
} as const;
export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];

export const ApplicationStatus = {
  SAVED: "saved",
  APPLIED: "applied",
  PHONE_SCREEN: "phone_screen",
  INTERVIEW: "interview",
  OFFER: "offer",
  REJECTED: "rejected",
} as const;
export type ApplicationStatusType =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

// Feature entitlements per tier (used for plan gating).
export const TierEntitlements: Record<
  SubscriptionTierType,
  { aiOptimizer: boolean; jobSearch: boolean; maxProfiles: number }
> = {
  free: { aiOptimizer: false, jobSearch: true, maxProfiles: 1 },
  basic: { aiOptimizer: true, jobSearch: true, maxProfiles: 3 },
  pro: { aiOptimizer: true, jobSearch: true, maxProfiles: 25 },
};
