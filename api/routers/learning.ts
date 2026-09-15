import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { learningItems, learningTopics, resumeProfiles } from "../db/schema";
import { chatCompletion, parseJsonFromAI, visionCompletion } from "../services/ai";
import { hasFeature, requireAIEntitlement } from "../lib/entitlements";
import { fetchJobText } from "../lib/fetch-job-text";
import { TRPCError } from "@trpc/server";

async function ownTopic(userId: number, topicId: number) {
  const rows = await getDb()
    .select()
    .from(learningTopics)
    .where(and(eq(learningTopics.id, topicId), eq(learningTopics.userId, userId)))
    .limit(1);
  return rows.at(0) ?? null;
}

export const learningRouter = router({
  list: authedProcedure
    .input(z.object({ category: z.string().optional(), topicId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(learningItems)
        .where(eq(learningItems.userId, ctx.user.id))
        .orderBy(desc(learningItems.createdAt));
      let out = rows;
      if (input?.category && input.category !== "all") out = out.filter((r) => r.category === input.category);
      if (input?.topicId != null) out = out.filter((r) => r.topicId === input.topicId);
      return out;
    }),

  // Add material: a link, pasted text, or text pulled from a screenshot.
  // The AI reviews whatever content it can access and saves a summary,
  // takeaways, and skill tags. Can be filed under a topic.
  add: authedProcedure
    .input(
      z.object({
        url: z.string().url().optional(),
        title: z.string().max(300).optional(),
        note: z.string().max(4000).optional(),
        // Pasted text, or text the client extracted from a screenshot/image.
        content: z.string().max(20000).optional(),
        imageRef: z.string().max(400).optional(),
        topicId: z.number().optional(),
        category: z.enum(["tip", "resume", "career", "industry"]).default("tip"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.url && !input.content && !input.note) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Add a link, paste text, or attach a screenshot's text." });
      }
      // If filed under a topic, verify ownership.
      if (input.topicId && !(await ownTopic(ctx.user.id, input.topicId))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found." });
      }

      let summary: string | null = null;
      let takeaways: string[] = [];
      let skillTags: string[] = [];

      const canAI = await hasFeature(ctx.user, "aiOptimizer");
      if (canAI) {
        // Prefer pasted content; otherwise fetch the page. Screenshots are
        // passed as extracted text in `content` from the client.
        let sourceText = input.content?.trim() ?? "";
        if (sourceText.length < 40 && input.url) {
          sourceText = await fetchJobText(input.url);
        }
        const source = sourceText
          ? `CONTENT (excerpt):\n${sourceText.slice(0, 6000)}`
          : "(No readable content; base this only on the title/note and keep it general.)";

        const res = await chatCompletion(
          [
            {
              role: "system",
              content:
                "You turn saved learning material (articles, posts, screenshots, notes) into concise, accurate study notes. Only state what the content supports; never invent claims. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: `A user saved this ${input.category} material:
URL: ${input.url ?? "(none)"}
Title/context: ${input.title ?? "(none)"}
Their note: ${input.note ?? "(none)"}
${source}

Produce:
{ "summary": "1-2 sentence summary of what this teaches", "takeaways": ["3-5 concrete points worth remembering"], "skillTags": ["0-5 specific skills/subjects this covers, e.g. \\"Kubernetes\\", \\"Calculus\\" — empty if none"] }
Return ONLY valid JSON.`,
            },
          ],
          { maxTokens: 800, temperature: 0.2, json: true },
        );
        if (res.success && res.content) {
          const parsed = parseJsonFromAI<{ summary: string; takeaways: string[]; skillTags?: string[] }>(res.content);
          summary = parsed?.summary ?? null;
          takeaways = parsed?.takeaways ?? [];
          skillTags = (parsed?.skillTags ?? []).filter(Boolean).slice(0, 5);
        }
      }

      const rows = await getDb()
        .insert(learningItems)
        .values({
          userId: ctx.user.id,
          topicId: input.topicId,
          url: input.url,
          title: input.title ?? (input.url ?? "Note"),
          category: input.category,
          content: input.content,
          imageRef: input.imageRef,
          summary,
          takeaways,
          skillTags,
        })
        .returning();
      return rows[0];
    }),

  remove: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .delete(learningItems)
        .where(and(eq(learningItems.id, input.id), eq(learningItems.userId, ctx.user.id)))
        .returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  // Mark a resource as learned (or move it back). On "done" its skill tags
  // merge into the profile's skills, so learning visibly upgrades the profile
  // and feeds future job-match scoring.
  setStatus: authedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "done"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .update(learningItems)
        .set({ status: input.status })
        .where(and(eq(learningItems.id, input.id), eq(learningItems.userId, ctx.user.id)))
        .returning();
      const item = rows[0];
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.status === "done") {
        const tags = ((item.skillTags as string[]) ?? []).filter(Boolean);
        if (tags.length) {
          const rp = (
            await db
              .select()
              .from(resumeProfiles)
              .where(eq(resumeProfiles.userId, ctx.user.id))
              .limit(1)
          ).at(0);
          if (rp) {
            const have = new Set((((rp.skills as string[]) ?? [])).map((s) => s.toLowerCase()));
            const merged = [...((rp.skills as string[]) ?? [])];
            for (const t of tags) if (!have.has(t.toLowerCase())) merged.push(t);
            await db.update(resumeProfiles).set({ skills: merged }).where(eq(resumeProfiles.id, rp.id));
          }
        }
      }
      return { success: true, item };
    }),

  // Aggregate takeaways into a set of profile-enhancement tips.
  digest: authedProcedure.mutation(async ({ ctx }) => {
    await requireAIEntitlement(ctx.user);
    const items = await getDb()
      .select()
      .from(learningItems)
      .where(eq(learningItems.userId, ctx.user.id))
      .orderBy(desc(learningItems.createdAt));
    if (items.length === 0) return { success: false as const, error: "Add some resources first." };

    const allTakeaways = items.flatMap((i) => (i.takeaways as string[]) ?? []);
    const res = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You synthesize a job seeker's saved learning into a prioritized action plan. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `From these saved takeaways, produce a prioritized plan to strengthen the user's profile and candidacy:
${allTakeaways.slice(0, 40).map((t) => `- ${t}`).join("\n")}

Return JSON: { "themes": ["3-5 recurring themes"], "actions": ["5-8 prioritized actions"] }
Return ONLY valid JSON.`,
        },
      ],
      { maxTokens: 1200, temperature: 0.2, json: true },
    );
    if (!res.success || !res.content) return { success: false as const, error: res.error };
    const parsed = parseJsonFromAI(res.content);
    return parsed
      ? { success: true as const, digest: parsed }
      : { success: false as const, error: "Could not parse." };
  }),

  // ─── Topics: subjects the user is building mastery in ───

  listTopics: authedProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(learningTopics)
      .where(eq(learningTopics.userId, ctx.user.id))
      .orderBy(desc(learningTopics.pinned), desc(learningTopics.updatedAt));
  }),

  createTopic: authedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(160),
        kind: z.enum(["topic", "certification", "person", "skill"]).default("topic"),
        goal: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .insert(learningTopics)
        .values({ userId: ctx.user.id, name: input.name, kind: input.kind, goal: input.goal })
        .returning();
      return rows[0];
    }),

  updateTopic: authedProcedure
    .input(z.object({ id: z.number(), goal: z.string().max(2000).optional(), progress: z.number().min(0).max(100).optional(), pinned: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const rows = await getDb()
        .update(learningTopics)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(learningTopics.id, id), eq(learningTopics.userId, ctx.user.id)))
        .returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return rows[0];
    }),

  removeTopic: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .delete(learningTopics)
        .where(and(eq(learningTopics.id, input.id), eq(learningTopics.userId, ctx.user.id)))
        .returning();
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  // Build (or rebuild) a topic's overview, key facts, and a short prep course,
  // grounded in the material the user has saved under it.
  buildTopic: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const db = getDb();
      const topic = await ownTopic(ctx.user.id, input.id);
      if (!topic) throw new TRPCError({ code: "NOT_FOUND" });

      const items = await db
        .select()
        .from(learningItems)
        .where(and(eq(learningItems.userId, ctx.user.id), eq(learningItems.topicId, input.id)))
        .orderBy(desc(learningItems.createdAt));

      const material = items
        .map((i) => `- ${i.title}: ${i.summary ?? ""} ${((i.takeaways as string[]) ?? []).join("; ")}`)
        .join("\n")
        .slice(0, 6000);

      const res = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a rigorous tutor. Build an accurate overview and a short, practical course for a subject the learner wants to master. Ground it in the learner's saved material where given, and general knowledge otherwise. Be honest about what you are unsure of. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Subject: ${topic.name}
Kind: ${topic.kind}
Learner's goal: ${topic.goal ?? "(not specified)"}
Saved material:
${material || "(none yet)"}

Return JSON:
{
  "overview": "3-5 sentence plain overview of the subject and why it matters for the goal",
  "keyFacts": ["5-8 key facts or concepts to know"],
  "course": { "modules": [ { "title": "", "summary": "1-2 sentences", "tasks": ["2-4 concrete practice tasks"] } ] }
}
Aim for 4-6 modules that build from basics to applied. Return ONLY valid JSON.`,
          },
        ],
        { maxTokens: 2200, temperature: 0.3, json: true },
      );
      if (!res.success || !res.content) return { success: false as const, error: res.error };
      const parsed = parseJsonFromAI<{ overview: string; keyFacts: string[]; course: unknown }>(res.content);
      if (!parsed) return { success: false as const, error: "Could not build the course. Try again." };

      const rows = await db
        .update(learningTopics)
        .set({ overview: parsed.overview, keyFacts: parsed.keyFacts, course: parsed.course, updatedAt: new Date() })
        .where(eq(learningTopics.id, input.id))
        .returning();
      return { success: true as const, topic: rows[0] };
    }),

  // Suggest topics to study based on the user's target role and saved skills.
  suggestTopics: authedProcedure.mutation(async ({ ctx }) => {
    await requireAIEntitlement(ctx.user);
    const db = getDb();
    const rp = (await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, ctx.user.id)).limit(1)).at(0);
    const existing = (await db.select().from(learningTopics).where(eq(learningTopics.userId, ctx.user.id))).map((t) => t.name);

    const res = await chatCompletion(
      [
        { role: "system", content: "You suggest high-leverage learning topics and certifications for a job seeker. Return ONLY valid JSON." },
        {
          role: "user",
          content: `Resume excerpt: ${(rp?.baseResumeText ?? "(none)").slice(0, 2000)}
Already tracking: ${existing.join(", ") || "(none)"}

Suggest topics worth mastering to become more competitive. Return JSON:
{ "topics": [ { "name": "", "kind": "topic|certification|skill", "why": "one line" } ] }
6-10 suggestions, skip ones already tracked. Return ONLY valid JSON.`,
        },
      ],
      { maxTokens: 1000, temperature: 0.4, json: true },
    );
    if (!res.success || !res.content) return { success: false as const, error: res.error };
    const parsed = parseJsonFromAI<{ topics: { name: string; kind: string; why: string }[] }>(res.content);
    return parsed ? { success: true as const, topics: parsed.topics ?? [] } : { success: false as const, error: "Could not parse." };
  }),

  // OCR: read text out of a screenshot so the user does not have to type it.
  // The image is sent as a data URL from the client. Returns extracted text
  // the client can then save as material (via `add`).
  ocr: authedProcedure
    .input(z.object({ imageDataUrl: z.string().min(20).max(8_000_000) }))
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      if (!/^data:image\//.test(input.imageDataUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That does not look like an image." });
      }
      const res = await visionCompletion({
        imageUrl: input.imageDataUrl,
        prompt:
          "Read this screenshot and return the meaningful text content only (article text, post, notes, slide). Preserve headings and bullet structure. Do not describe the image or add commentary.",
        maxTokens: 1800,
      });
      if (!res.success || !res.content) return { success: false as const, text: null, error: res.error };
      return { success: true as const, text: res.content.trim(), error: null };
    }),

  // Refresh latest: re-read the source links saved under a topic and produce a
  // short "what to know now" note. Honest about coverage: it summarizes the
  // pages it can actually fetch, and says so when a page is unreadable. It does
  // not claim to have trawled the whole web.
  refreshLatest: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const db = getDb();
      const topic = await ownTopic(ctx.user.id, input.id);
      if (!topic) throw new TRPCError({ code: "NOT_FOUND" });

      const items = await db
        .select()
        .from(learningItems)
        .where(and(eq(learningItems.userId, ctx.user.id), eq(learningItems.topicId, input.id)))
        .orderBy(desc(learningItems.createdAt));

      const urls = items.map((i) => i.url).filter((u): u is string => !!u).slice(0, 6);
      const fetched: { url: string; text: string }[] = [];
      for (const url of urls) {
        const text = await fetchJobText(url);
        if (text) fetched.push({ url, text: text.slice(0, 3000) });
      }

      const sources = fetched.length
        ? fetched.map((f) => `SOURCE ${f.url}:\n${f.text}`).join("\n\n---\n\n")
        : "(No source links could be read. Base the note on the topic name and general knowledge, and say clearly that no fresh sources were available.)";

      const res = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You brief a learner on the current state of a topic, grounded in the provided sources. Be accurate and honest: only claim what the sources support, and flag when you are relying on general knowledge rather than fresh sources. Note dates when present. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Topic: ${topic.name}
${sources}

Return JSON:
{ "items": [ { "title": "short headline", "note": "1-2 sentence takeaway", "url": "source url if from a source, else omit" } ], "caveat": "one honest sentence on how fresh/complete this is" }
5-8 items. Return ONLY valid JSON.`,
          },
        ],
        { maxTokens: 1600, temperature: 0.3, json: true },
      );
      if (!res.success || !res.content) return { success: false as const, error: res.error };
      const parsed = parseJsonFromAI<{ items: { title: string; note: string; url?: string }[]; caveat?: string }>(res.content);
      if (!parsed) return { success: false as const, error: "Could not parse the update." };

      const latest = { updatedAt: new Date().toISOString(), items: parsed.items ?? [], caveat: parsed.caveat ?? "" };
      const rows = await db
        .update(learningTopics)
        .set({ latest, updatedAt: new Date() })
        .where(eq(learningTopics.id, input.id))
        .returning();
      return { success: true as const, topic: rows[0], sourcesRead: fetched.length };
    }),
});
