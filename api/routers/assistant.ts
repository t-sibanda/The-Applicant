import { z } from "zod";
import { and, eq, asc, desc } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { getDb } from "../db/client";
import { conversations, messages, resumeProfiles } from "../db/schema";
import { chatCompletion, parseJsonFromAI, type ChatMessage } from "../services/ai";
import { requireAIEntitlement } from "../lib/entitlements";
import { TRPCError } from "@trpc/server";

/**
 * Stateful conversational assistant. Unlike the one-shot AI Coach, this keeps
 * a persistent thread and can edit a "working document" (the user's resume)
 * that stays downloadable. The assistant returns a chat reply plus, when it
 * changed the document, the full updated document.
 */

const ASSISTANT_SYSTEM = `You are an expert resume writer and career strategist embedded in a job-hunt app.
You hold a running conversation with the user and maintain a WORKING RESUME DOCUMENT.

On each turn you receive: the conversation so far, and the current working document.
Respond with a JSON object ONLY, no markdown fences:
{
  "reply": "your conversational response to the user",
  "updatedDocument": "the full updated resume document IF you changed it, otherwise null"
}

Rules:
- Only include updatedDocument when the user asked for a change to the resume/profile; otherwise null.
- Never fabricate experience, employers, dates, or credentials. Improve wording, structure, impact, and keyword alignment only.
- Keep the document ATS-friendly plain text with CAPS section headers.
- Be concise and specific in "reply".`;

async function ownConversation(userId: number, id: number) {
  const rows = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return rows.at(0) ?? null;
}

export const assistantRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(conversations)
      .where(eq(conversations.userId, ctx.user.id))
      .orderBy(desc(conversations.updatedAt));
  }),

  create: authedProcedure
    .input(z.object({ title: z.string().max(200).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      // Seed the working document from the user's default resume, if any.
      const resume = await getDb()
        .select()
        .from(resumeProfiles)
        .where(eq(resumeProfiles.userId, ctx.user.id))
        .limit(1);
      const rows = await getDb()
        .insert(conversations)
        .values({
          userId: ctx.user.id,
          title: input?.title ?? "Resume Assistant",
          workingDoc: resume.at(0)?.baseResumeText ?? "",
        })
        .returning();
      return rows[0];
    }),

  getMessages: authedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await ownConversation(ctx.user.id, input.conversationId);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      const msgs = await getDb()
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(asc(messages.createdAt));
      return { conversation: conv, messages: msgs };
    }),

  send: authedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().min(1).max(8000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAIEntitlement(ctx.user);
      const db = getDb();
      const conv = await ownConversation(ctx.user.id, input.conversationId);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

      // Persist the user's message.
      await db.insert(messages).values({
        conversationId: conv.id,
        role: "user",
        content: input.content,
      });

      // Build the AI context: recent history + working doc.
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt));

      const aiMessages: ChatMessage[] = [
        { role: "system", content: ASSISTANT_SYSTEM },
        {
          role: "system",
          content: `CURRENT WORKING DOCUMENT:\n${conv.workingDoc || "(empty)"}`,
        },
        ...history.slice(-12).map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      const res = await chatCompletion(aiMessages, { maxTokens: 3500, temperature: 0.4, json: true });
      if (!res.success || !res.content) {
        return { success: false as const, reply: null, error: res.error };
      }

      // The assistant returns JSON { reply, updatedDocument }.
      const parsed = parseJsonFromAI<{
        reply: string;
        updatedDocument: string | null;
      }>(res.content);

      const reply = parsed?.reply ?? res.content;
      const updatedDoc = parsed?.updatedDocument ?? null;

      await db.insert(messages).values({
        conversationId: conv.id,
        role: "assistant",
        content: reply,
      });

      if (updatedDoc && updatedDoc.trim().length > 0) {
        await db
          .update(conversations)
          .set({ workingDoc: updatedDoc, updatedAt: new Date() })
          .where(eq(conversations.id, conv.id));
      } else {
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conv.id));
      }

      return {
        success: true as const,
        reply,
        workingDoc: updatedDoc ?? conv.workingDoc,
        documentChanged: !!updatedDoc,
        error: null,
      };
    }),

  // Save the working document back to the user's base resume.
  saveDocToResume: authedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await ownConversation(ctx.user.id, input.conversationId);
      if (!conv?.workingDoc)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to save." });
      const db = getDb();
      const resume = await db
        .select()
        .from(resumeProfiles)
        .where(eq(resumeProfiles.userId, ctx.user.id))
        .limit(1);
      if (resume.at(0)) {
        await db
          .update(resumeProfiles)
          .set({ baseResumeText: conv.workingDoc })
          .where(eq(resumeProfiles.id, resume[0].id));
      } else {
        await db.insert(resumeProfiles).values({
          userId: ctx.user.id,
          baseResumeText: conv.workingDoc,
          isDefault: true,
        });
      }
      return { success: true };
    }),

  setWorkingDoc: authedProcedure
    .input(z.object({ conversationId: z.number(), doc: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await ownConversation(ctx.user.id, input.conversationId);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      await getDb()
        .update(conversations)
        .set({ workingDoc: input.doc, updatedAt: new Date() })
        .where(eq(conversations.id, conv.id));
      return { success: true };
    }),
});
