import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users, type InsertUser } from "../db/schema";

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows.at(0);
}

export async function findUserById(id: number) {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return rows.at(0);
}

export async function createUser(data: InsertUser) {
  const rows = await getDb()
    .insert(users)
    .values({ ...data, email: data.email.toLowerCase() })
    .returning();
  return rows[0];
}

export async function updateLastSignIn(id: number) {
  await getDb()
    .update(users)
    .set({ lastSignInAt: new Date() })
    .where(eq(users.id, id));
}
