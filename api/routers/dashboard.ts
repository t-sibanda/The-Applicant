import { eq } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { applications, applicationEvents, jobs } from "../db/schema";
import { ApplicationStatus } from "../../shared/constants";

// Statuses that mean "the application actually left your hands".
const SENT_STATUSES: string[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.PHONE_SCREEN,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];
const RESPONSE_STATUSES: string[] = [
  ApplicationStatus.PHONE_SCREEN,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
];
const INTERVIEW_STATUSES: string[] = [
  ApplicationStatus.PHONE_SCREEN,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
];

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

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

  /**
   * Outcomes analytics, all computed from real data (applications + the audit
   * trail of status transitions). No fabricated numbers: when there is not
   * enough data to say something, we say so via `sampleSize` and let the client
   * hold back weak claims.
   */
  analytics: authedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, ctx.user.id));
    const events = await db
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.userId, ctx.user.id));

    // An application counts as "sent" if it is in a sent status now, or ever
    // transitioned into one (covers apps later marked rejected).
    const everSent = new Set<number>();
    for (const e of events) {
      if (SENT_STATUSES.includes(e.toStatus)) everSent.add(e.applicationId);
    }
    for (const a of apps) {
      if (SENT_STATUSES.includes(a.status)) everSent.add(a.id);
    }
    const sent = apps.filter((a) => everSent.has(a.id));
    const sentCount = sent.length;

    // Responses / interviews from current status (terminal-aware).
    const responded = sent.filter((a) => RESPONSE_STATUSES.includes(a.status)).length;
    const interviewed = sent.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length;
    const offers = sent.filter((a) => a.status === ApplicationStatus.OFFER).length;

    // Median time from "applied" to first response, using the event trail.
    const appliedAt = new Map<number, number>();
    const respondedAt = new Map<number, number>();
    for (const e of events) {
      const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      if (!t) continue;
      if (e.toStatus === ApplicationStatus.APPLIED && !appliedAt.has(e.applicationId)) {
        appliedAt.set(e.applicationId, t);
      }
      if (RESPONSE_STATUSES.includes(e.toStatus) && !respondedAt.has(e.applicationId)) {
        respondedAt.set(e.applicationId, t);
      }
    }
    const responseDays: number[] = [];
    for (const [id, at] of appliedAt) {
      const r = respondedAt.get(id);
      if (r && r >= at) responseDays.push((r - at) / 86_400_000);
    }
    responseDays.sort((a, b) => a - b);
    const medianResponseDays =
      responseDays.length > 0
        ? Math.round(responseDays[Math.floor(responseDays.length / 2)] * 10) / 10
        : null;

    // Does tailoring correlate with interviews? Compare sent apps that had a
    // drafted (tailored) resume vs those that did not. Only surfaced when both
    // groups have enough samples to be worth mentioning.
    const withDraft = sent.filter((a) => !!(a.draftResume && a.draftResume.trim()));
    const withoutDraft = sent.filter((a) => !(a.draftResume && a.draftResume.trim()));
    const tailoredInterviewRate = pct(
      withDraft.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length,
      withDraft.length,
    );
    const untailoredInterviewRate = pct(
      withoutDraft.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length,
      withoutDraft.length,
    );

    // Does ATS score band correlate with interviews? Group sent apps by score.
    const band = (s: number | null) => (s == null ? "unknown" : s >= 70 ? "high" : s >= 50 ? "mid" : "low");
    const bands: Record<string, { total: number; interviews: number }> = {
      high: { total: 0, interviews: 0 },
      mid: { total: 0, interviews: 0 },
      low: { total: 0, interviews: 0 },
    };
    for (const a of sent) {
      const b = band(a.atsScore ?? null);
      if (b === "unknown") continue;
      bands[b].total++;
      if (INTERVIEW_STATUSES.includes(a.status)) bands[b].interviews++;
    }

    return {
      sampleSize: sentCount,
      sent: sentCount,
      responseRate: pct(responded, sentCount),
      interviewRate: pct(interviewed, sentCount),
      offerRate: pct(offers, sentCount),
      medianResponseDays,
      tailoring: {
        tailoredCount: withDraft.length,
        untailoredCount: withoutDraft.length,
        tailoredInterviewRate,
        untailoredInterviewRate,
      },
      atsBands: {
        high: { total: bands.high.total, interviewRate: pct(bands.high.interviews, bands.high.total) },
        mid: { total: bands.mid.total, interviewRate: pct(bands.mid.interviews, bands.mid.total) },
        low: { total: bands.low.total, interviewRate: pct(bands.low.interviews, bands.low.total) },
      },
    };
  }),

  /**
   * Actionable nudges from the current state. Each nudge is derived from real
   * records so it is always true right now: unsent drafts, applications gone
   * quiet, and low-ATS drafts worth improving before sending.
   */
  nudges: authedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, ctx.user.id));
    const now = Date.now();
    const daysSince = (d: Date | null | undefined) =>
      d ? Math.floor((now - new Date(d).getTime()) / 86_400_000) : 0;

    const out: { id: string; kind: string; title: string; detail: string; cta: string }[] = [];

    // Drafts/ready sitting unsent for a while.
    const staleDrafts = apps.filter(
      (a) => (a.status === ApplicationStatus.DRAFT || a.status === ApplicationStatus.READY) && daysSince(a.createdAt) >= 3,
    );
    if (staleDrafts.length) {
      out.push({
        id: "stale-drafts",
        kind: "unsent",
        title: `${staleDrafts.length} draft${staleDrafts.length === 1 ? "" : "s"} waiting to be sent`,
        detail: "Documents are ready. Sending sooner beats sending perfect.",
        cta: "Review and apply",
      });
    }

    // Applied but quiet for 10+ days: suggest a follow-up.
    const quiet = apps.filter((a) => a.status === ApplicationStatus.APPLIED && daysSince(a.appliedAt ?? a.createdAt) >= 10);
    if (quiet.length) {
      out.push({
        id: "quiet-applications",
        kind: "followup",
        title: `${quiet.length} application${quiet.length === 1 ? "" : "s"} with no reply in 10+ days`,
        detail: "A short, polite follow-up can restart a stalled application.",
        cta: "Draft a follow-up",
      });
    }

    // Low-ATS drafts worth improving before they go out.
    const weak = apps.filter(
      (a) => (a.status === ApplicationStatus.DRAFT || a.status === ApplicationStatus.READY) && a.atsScore != null && a.atsScore < 55,
    );
    if (weak.length) {
      out.push({
        id: "weak-ats",
        kind: "improve",
        title: `${weak.length} draft${weak.length === 1 ? "" : "s"} below a strong ATS score`,
        detail: "Improve keyword coverage before sending to clear more filters.",
        cta: "Improve to target",
      });
    }

    return { nudges: out };
  }),
});
