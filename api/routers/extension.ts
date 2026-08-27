import { eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { resumeProfiles, applications } from "../db/schema";

/**
 * Read-only payload for the autofill browser extension. Returns the fields the
 * extension fills on an application page (contact info + latest tailored
 * materials). The extension authenticates via the same session cookie
 * (credentials: include), so no separate token store is needed.
 *
 * The extension only FILLS fields on user click and never auto-submits —
 * keeping within third-party site terms of service.
 */
export const extensionRouter = router({
  payload: authedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const resume = (
      await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)
    ).at(0);

    // Most recent tailored materials (from a prepared application), if any.
    const latestApp = (
      await db
        .select()
        .from(applications)
        .where(eq(applications.userId, ctx.user.id))
        .orderBy(desc(applications.createdAt))
        .limit(1)
    ).at(0);

    const links = (resume?.links as Record<string, string> | null) ?? {};

    return {
      identity: {
        name: resume?.fullName ?? ctx.user.displayName ?? "",
        email: resume?.email ?? ctx.user.email ?? "",
        phone: resume?.phone ?? "",
        linkedin: links.linkedin ?? links.linkedIn ?? "",
        portfolio: links.portfolio ?? links.website ?? "",
      },
      baseResumeText: resume?.baseResumeText ?? "",
      tailoredResume: latestApp?.draftResume ?? "",
      coverLetter: latestApp?.draftCoverLetter ?? "",
    };
  }),
});
