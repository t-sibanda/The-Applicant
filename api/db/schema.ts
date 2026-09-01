import {
  pgSchema,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// The Applicant keeps all its tables in a dedicated Postgres schema so it never
// collides with other apps that may share the same database.
export const appSchema = pgSchema("applicant");
const pgTable = appSchema.table;

// ─── users ───────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 120 }),
    role: varchar("role", { length: 20 }).notNull().default("user"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    subscriptionTier: varchar("subscription_tier", { length: 20 })
      .notNull()
      .default("free"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

// ─── profiles (targeting contexts) ───────────────────────────────
export const profiles = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    targetIndustry: varchar("target_industry", { length: 120 }),
    targetRole: varchar("target_role", { length: 120 }),
    locationPrefs: jsonb("location_prefs"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("profiles_user_idx").on(t.userId),
  }),
);

// ─── resume_profiles ─────────────────────────────────────────────
export const resumeProfiles = pgTable(
  "resume_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    fullName: varchar("full_name", { length: 200 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    links: jsonb("links"),
    baseResumeText: text("base_resume_text").notNull().default(""),
    baseResumeJson: jsonb("base_resume_json"),
    voiceProfile: text("voice_profile"),
    voiceJson: jsonb("voice_json"),
    // "Who is X?" self-discovery answers + AI persona summary.
    personaJson: jsonb("persona_json"),
    // Gamified personality results (DISC, Big Five, values, Johari).
    personalityJson: jsonb("personality_json"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("resume_profiles_user_idx").on(t.userId),
  }),
);

// ─── resume_versions ─────────────────────────────────────────────
export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: serial("id").primaryKey(),
    resumeProfileId: integer("resume_profile_id")
      .notNull()
      .references(() => resumeProfiles.id, { onDelete: "cascade" }),
    // A user-facing name for a saved resume sample (for example "Product Manager").
    label: varchar("label", { length: 120 }),
    tailoredResumeText: text("tailored_resume_text"),
    coverLetter: text("cover_letter"),
    jobRef: varchar("job_ref", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    profileIdx: index("resume_versions_profile_idx").on(t.resumeProfileId),
  }),
);

// ─── companies ───────────────────────────────────────────────────
export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 120 }),
    compAboveMedian: boolean("comp_above_median"),
    cultureScore: integer("culture_score"),
    retentionScore: integer("retention_score"),
    qualityScore: integer("quality_score"),
    qualityBasis: jsonb("quality_basis"),
    unrated: boolean("unrated").notNull().default(true),
  },
  (t) => ({
    nameIdx: index("companies_name_idx").on(t.name),
  }),
);

// ─── jobs ────────────────────────────────────────────────────────
export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    sourceName: varchar("source_name", { length: 80 }),
    sourceUrl: text("source_url"),
    compensation: jsonb("compensation"),
    qualityScore: integer("quality_score"),
    relevanceScore: integer("relevance_score"),
    postedDate: varchar("posted_date", { length: 40 }),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    dedupeHash: varchar("dedupe_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("jobs_user_idx").on(t.userId),
    dedupeIdx: index("jobs_dedupe_idx").on(t.profileId, t.dedupeHash),
  }),
);

// ─── applications ────────────────────────────────────────────────
export const applications = pgTable(
  "applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    companyName: varchar("company_name", { length: 255 }),
    jobTitle: varchar("job_title", { length: 300 }),
    jobUrl: text("job_url"),
    status: varchar("status", { length: 30 }).notNull().default("applied"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow(),
    linkedVersionId: integer("linked_version_id").references(
      () => resumeVersions.id,
      { onDelete: "set null" },
    ),
    // Review-mode assisted apply: drafted materials the user reviews/edits.
    draftResume: text("draft_resume"),
    draftCoverLetter: text("draft_cover_letter"),
    // The job description text, kept so the workspace can scan and analyze
    // without re-pasting, plus the latest ATS fit score for a quick read.
    jobDescription: text("job_description"),
    atsScore: integer("ats_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("applications_user_idx").on(t.userId),
  }),
);

// ─── subscriptions ───────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubId: varchar("stripe_sub_id", { length: 255 }),
  plan: varchar("plan", { length: 40 }),
  status: varchar("status", { length: 40 }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
});

// ─── support_requests ────────────────────────────────────────────
export const supportRequests = pgTable(
  "support_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 255 }).notNull(),
    message: text("message").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("support_status_idx").on(t.status),
  }),
);

// ─── notifications ───────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    payload: jsonb("payload"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
  }),
);

// ─── scraping_logs ───────────────────────────────────────────────
export const scrapingLogs = pgTable("scraping_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  profileId: integer("profile_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  sourceName: varchar("source_name", { length: 80 }),
  count: integer("count").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── conversations (stateful assistant threads) ─────────────────
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull().default("Assistant"),
    // The current working document the assistant is editing (downloadable).
    workingDoc: text("working_doc"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ userIdx: index("conversations_user_idx").on(t.userId) }),
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // user | assistant | system
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ convIdx: index("messages_conv_idx").on(t.conversationId) }),
);

// ─── saved_items (profile hub: saved jobs, links, notes) ────────
export const savedItems = pgTable(
  "saved_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 20 }).notNull(), // job | link | note
    title: varchar("title", { length: 300 }),
    url: text("url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ userIdx: index("saved_items_user_idx").on(t.userId) }),
);

// ─── portfolios (self-marketing pages) ──────────────────────────
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: varchar("headline", { length: 200 }),
  about: text("about"),
  // JSON arrays of structured content.
  accomplishments: jsonb("accomplishments"),
  projects: jsonb("projects"),
  publications: jsonb("publications"),
  skills: jsonb("skills"),
  links: jsonb("links"),
  template: varchar("template", { length: 40 }).notNull().default("modern"),
  accent: varchar("accent", { length: 20 }).notNull().default("#ff6b35"),
  visibility: jsonb("visibility"), // which sections to show
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── learning_items (curated links → training material / tips) ──
export const learningItems = pgTable(
  "learning_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: varchar("title", { length: 300 }),
    category: varchar("category", { length: 40 }).notNull().default("tip"), // tip | resume | career | industry
    summary: text("summary"),
    takeaways: jsonb("takeaways"), // string[] actionable points
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ userIdx: index("learning_user_idx").on(t.userId) }),
);

// ─── feature_grants (per-user admin overrides, optional expiry) ─
export const featureGrants = pgTable(
  "feature_grants",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feature: varchar("feature", { length: 60 }).notNull(),
    // value stored as text: "true"/"false" for booleans, or a number as string.
    value: varchar("value", { length: 40 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ userIdx: index("feature_grants_user_idx").on(t.userId) }),
);

// ─── Types ───────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type LearningItem = typeof learningItems.$inferSelect;
export type FeatureGrant = typeof featureGrants.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type SavedItem = typeof savedItems.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export type ResumeProfile = typeof resumeProfiles.$inferSelect;
export type ResumeVersion = typeof resumeVersions.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SupportRequest = typeof supportRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
