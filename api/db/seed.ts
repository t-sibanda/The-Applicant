import { eq } from "drizzle-orm";
import { getDb, getSql } from "./client";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";
import { env } from "../lib/env";
import { Roles, SubscriptionTier, UserStatus } from "../../shared/constants";

/**
 * Seed script: creates the bootstrap admin account (idempotent).
 * Run with: npm run db:seed
 */
async function seed() {
  const db = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, env.admin.email))
    .limit(1);

  if (existing.at(0)) {
    // eslint-disable-next-line no-console
    console.log(`Admin already exists: ${env.admin.email}`);
  } else {
    const passwordHash = await hashPassword(env.admin.password);
    await db.insert(users).values({
      email: env.admin.email,
      passwordHash,
      displayName: "Administrator",
      role: Roles.ADMIN,
      status: UserStatus.ACTIVE,
      subscriptionTier: SubscriptionTier.PRO,
    });
    // eslint-disable-next-line no-console
    console.log(`Created admin: ${env.admin.email}`);
  }

  await getSql().end();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
