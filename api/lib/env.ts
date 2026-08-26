import "dotenv/config";

/**
 * Centralized configuration with fail-fast validation.
 *
 * - Required vars are enforced only in production (so local dev and tests can
 *   run without a full environment).
 * - Optional integrations expose an `enabled` flag; when their keys are absent
 *   the related feature degrades gracefully instead of crashing.
 */

const isProduction = process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (isProduction) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return "";
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const ai = {
  apiUrl: optional(
    "AI_API_URL",
    "https://api.groq.com/openai/v1/chat/completions",
  ),
  apiKey: optional("AI_API_KEY"),
  model: optional("AI_MODEL", "openai/gpt-oss-120b"),
  fallbackApiUrl: optional("AI_FALLBACK_API_URL"),
  fallbackApiKey: optional("AI_FALLBACK_API_KEY"),
  fallbackModel: optional("AI_FALLBACK_MODEL"),
};

const storage = {
  // local | s3 | supabase
  provider: optional("STORAGE_PROVIDER", "local"),
  s3Endpoint: optional("S3_ENDPOINT"),
  s3Region: optional("S3_REGION"),
  s3Bucket: optional("S3_BUCKET"),
  s3AccessKeyId: optional("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: optional("S3_SECRET_ACCESS_KEY"),
  localDir: optional("LOCAL_STORAGE_DIR", "./uploads"),
  // Supabase Storage (durable object storage on your existing Supabase project)
  supabaseUrl: optional("SUPABASE_URL"),
  supabaseServiceKey: optional("SUPABASE_SERVICE_KEY"),
  supabaseBucket: optional("SUPABASE_BUCKET", "documents"),
};

const stripe = {
  secretKey: optional("STRIPE_SECRET_KEY"),
  webhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  priceBasic: optional("STRIPE_PRICE_BASIC"),
  pricePro: optional("STRIPE_PRICE_PRO"),
};

const jobs = {
  adzunaAppId: optional("JOBS_ADZUNA_APP_ID"),
  adzunaAppKey: optional("JOBS_ADZUNA_APP_KEY"),
  usaJobsApiKey: optional("JOBS_USAJOBS_API_KEY"),
  remotiveEnabled: optional("JOBS_REMOTIVE_ENABLED", "true") === "true",
};

export const env = {
  isProduction,
  port: parseInt(optional("PORT", "8787"), 10),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET") || "dev-insecure-session-secret",

  ai,
  storage,
  stripe,
  jobs,

  admin: {
    email: optional("ADMIN_EMAIL", "admin@theapplicant.local"),
    password: optional("ADMIN_PASSWORD", "changeme123"),
  },
};

/** Which optional integrations are configured (surfaced by /api/health). */
export function integrationStatus() {
  return {
    ai: !!env.ai.apiKey,
    aiFallback: !!env.ai.fallbackApiKey,
    storage:
      env.storage.provider === "s3"
        ? env.storage.s3Bucket
          ? "s3"
          : "local"
        : env.storage.provider === "supabase"
          ? env.storage.supabaseUrl && env.storage.supabaseServiceKey
            ? "supabase"
            : "local"
          : "local",
    payments: !!env.stripe.secretKey,
    jobSources: {
      adzuna: !!(env.jobs.adzunaAppId && env.jobs.adzunaAppKey),
      usaJobs: !!env.jobs.usaJobsApiKey,
      remotive: env.jobs.remotiveEnabled,
    },
  };
}
