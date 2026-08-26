import { eq } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { applications, jobs } from "../db/schema";
import { ApplicationStatus } from "../../shared/constants";

export const dashboardRouter = router({
  stats: authedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, ctx.user.id));
    const jobRows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, ctx.user.id));

    const byStatus: Record<string, number> = {};
    for (const a of apps) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    }

    const totalApps = apps.length;
    const offers = byStatus[ApplicationStatus.OFFER] ?? 0;
    const interviews =
      (byStatus[ApplicationStatus.INTERVIEW] ?? 0) +
      (byStatus[ApplicationStatus.PHONE_SCREEN] ?? 0);
    const matchRate =
      totalApps > 0 ? Math.round((interviews / totalApps) * 100) : 0;

    return {
      totalJobs: jobRows.length,
      totalApplications: totalApps,
      offers,
      interviews,
      matchRate,
      byStatus,
    };
  }),
});
