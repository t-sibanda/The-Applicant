// Shared constants used by both client and server.

export const SESSION_COOKIE = "ta_session";

// Industry options offered across profiles and company suggestions. The `tags`
// map an industry to the directory tags used for matching employers.
export const INDUSTRIES = [
  { id: "technology", label: "Technology", tags: ["software", "ai", "ml", "cloud", "developer tools", "infrastructure", "big tech"] },
  { id: "finance", label: "Finance", tags: ["fintech", "payments", "banking", "investing", "crypto"] },
  { id: "healthcare", label: "Healthcare", tags: ["healthcare", "biotech", "life sciences", "medical", "pharma"] },
  { id: "entertainment", label: "Entertainment", tags: ["media", "streaming", "gaming", "entertainment", "music", "video"] },
  { id: "sustainability", label: "Sustainability", tags: ["energy", "climate", "cleantech", "environment", "renewable"] },
  { id: "manufacturing", label: "Manufacturing", tags: ["manufacturing", "hardware", "automotive", "industrial", "supply chain", "robotics"] },
  { id: "consulting", label: "Consulting", tags: ["consulting", "advisory", "strategy", "professional services"] },
  { id: "creative", label: "Creative Arts", tags: ["design", "creative", "media", "art", "content", "product"] },
  { id: "education", label: "Education", tags: ["education", "edtech", "learning", "training", "academic"] },
  { id: "retail", label: "Retail", tags: ["retail", "ecommerce", "marketplace", "consumer", "logistics"] },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]["id"];

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
  DRAFT: "draft",
  READY: "ready",
  SAVED: "saved",
  APPLIED: "applied",
  PHONE_SCREEN: "phone_screen",
  INTERVIEW: "interview",
  OFFER: "offer",
  REJECTED: "rejected",
} as const;
export type ApplicationStatusType =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

// Allowed pipeline moves. Keeps the tracker honest: an application flows
// forward through real stages, and terminal states (offer, rejected) are
// final. "rejected" is reachable from any non-terminal stage.
export const ApplicationTransitions: Record<
  ApplicationStatusType,
  ApplicationStatusType[]
> = {
  saved: ["draft", "applied", "rejected"],
  draft: ["ready", "saved", "rejected"],
  ready: ["applied", "draft", "rejected"],
  applied: ["phone_screen", "interview", "rejected"],
  phone_screen: ["interview", "applied", "rejected"],
  interview: ["offer", "phone_screen", "rejected"],
  offer: [],
  rejected: [],
};

export const TERMINAL_APPLICATION_STATUSES: ApplicationStatusType[] = [
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];

// The full feature catalog. Boolean features + a few numeric caps.
export const Features = {
  AI_OPTIMIZER: "aiOptimizer",
  JOB_SEARCH: "jobSearch",
  SEMI_APPLY: "semiApply", // review-mode assisted apply
  AUTO_APPLY: "autoApply", // bulk prepare drafts across top matches
  PORTFOLIO: "portfolio",
  CAREER: "career",
  LEARNING: "learning",
  MAX_PROFILES: "maxProfiles", // numeric
  DAILY_AUTO_APPLY_CAP: "dailyAutoApplyCap", // numeric
} as const;
export type FeatureKey = (typeof Features)[keyof typeof Features];

export type TierPlan = {
  aiOptimizer: boolean;
  jobSearch: boolean;
  semiApply: boolean;
  autoApply: boolean;
  portfolio: boolean;
  career: boolean;
  learning: boolean;
  maxProfiles: number;
  dailyAutoApplyCap: number;
};

// Per-tier defaults. Admin grants can override any of these per user.
export const TierEntitlements: Record<SubscriptionTierType, TierPlan> = {
  free: {
    aiOptimizer: false, jobSearch: true, semiApply: false, autoApply: false,
    portfolio: false, career: false, learning: true,
    maxProfiles: 1, dailyAutoApplyCap: 0,
  },
  basic: {
    aiOptimizer: true, jobSearch: true, semiApply: true, autoApply: false,
    portfolio: true, career: true, learning: true,
    maxProfiles: 3, dailyAutoApplyCap: 0,
  },
  pro: {
    aiOptimizer: true, jobSearch: true, semiApply: true, autoApply: true,
    portfolio: true, career: true, learning: true,
    maxProfiles: 25, dailyAutoApplyCap: 20,
  },
};
