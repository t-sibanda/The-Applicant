import { getDb } from "../db/client";
import { notifications } from "../db/schema";

/** Emit an in-app notification for a user. Best-effort; never throws upward. */
export async function notify(
  userId: number,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await getDb().insert(notifications).values({ userId, type, payload });
  } catch {
    // Notifications are non-critical; swallow errors.
  }
}
