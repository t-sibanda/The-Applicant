import { router, publicProcedure } from "./trpc";
import { authRouter } from "./routers/auth";
import { profilesRouter } from "./routers/profiles";
import { adminRouter } from "./routers/admin";
import { billingRouter } from "./routers/billing";
import { aiRouter } from "./routers/ai";
import { jobsRouter } from "./routers/jobs";
import { resumeRouter } from "./routers/resume";
import { applicationsRouter } from "./routers/applications";
import { dashboardRouter } from "./routers/dashboard";
import { notificationsRouter } from "./routers/notifications";
import { assistantRouter } from "./routers/assistant";
import { savedRouter } from "./routers/saved";

export const appRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  profiles: profilesRouter,
  admin: adminRouter,
  billing: billingRouter,
  ai: aiRouter,
  jobs: jobsRouter,
  resume: resumeRouter,
  applications: applicationsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  assistant: assistantRouter,
  saved: savedRouter,
});

export type AppRouter = typeof appRouter;
