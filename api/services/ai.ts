import { env } from "../lib/env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResult {
  success: boolean;
  content: string | null;
  error: string | null;
}

/** True if at least a primary AI provider key is configured. */
export function isAIEnabled(): boolean {
  return !!env.ai.apiKey;
}

/**
 * Trim message content so total input stays within a character budget
 * (roughly maps to token limits). The system message is preserved; the
 * largest user content is truncated first. Prevents provider 413 (TPM) errors
 * on free tiers with large resumes/job descriptions.
 */
function trimMessages(
  messages: ChatMessage[],
  maxChars: number,
): ChatMessage[] {
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total <= maxChars) return messages;

  // Proportionally shrink each non-system message to fit the budget.
  const systemChars = messages
    .filter((m) => m.role === "system")
    .reduce((n, m) => n + m.content.length, 0);
  const budgetForRest = Math.max(1000, maxChars - systemChars);
  const restChars = total - systemChars || 1;
  const ratio = budgetForRest / restChars;

  return messages.map((m) => {
    if (m.role === "system") return m;
    const keep = Math.max(200, Math.floor(m.content.length * ratio));
    return m.content.length > keep
      ? { ...m, content: m.content.slice(0, keep) + "\n…[truncated]" }
      : m;
  });
}

async function callProvider(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<AIResult> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      // Reasoning models (e.g. gpt-oss) consume tokens "thinking"; give ample
      // budget so the visible answer isn't truncated.
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      content: null,
      error: `AI provider error ${response.status}: ${errorText.slice(0, 200)}`,
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) {
    return { success: false, content: null, error: "AI returned empty content." };
  }
  return { success: true, content, error: null };
}

/**
 * Provider-agnostic chat completion with automatic fallback.
 * Never throws: always returns a structured AIResult.
 * Model id and provider come from config so a deprecation is a config change.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {},
): Promise<AIResult> {
  // Groq free tier caps total tokens-per-minute (input + output) at ~8000.
  // Keep the output budget modest so prompt + completion stays under the limit.
  const maxTokens = opts.maxTokens ?? 3000;
  let lastError: string | null = null;

  // Guard against oversized inputs: trim very long message content so the
  // input tokens + maxTokens stay under the free-tier TPM ceiling. ~4 chars ≈
  // 1 token; we cap total input characters to keep input under ~4000 tokens.
  const MAX_INPUT_CHARS = 16000;
  const trimmed = trimMessages(messages, MAX_INPUT_CHARS);

  if (env.ai.apiKey) {
    try {
      const result = await callProvider(
        env.ai.apiUrl,
        env.ai.apiKey,
        opts.model || env.ai.model,
        trimmed,
        maxTokens,
      );
      if (result.success) return result;
      // Keep the real provider error so it can be surfaced if all attempts fail.
      lastError = result.error;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (env.ai.fallbackApiKey && env.ai.fallbackApiUrl) {
    try {
      const result = await callProvider(
        env.ai.fallbackApiUrl,
        env.ai.fallbackApiKey,
        env.ai.fallbackModel || env.ai.model,
        trimmed,
        maxTokens,
      );
      if (result.success) return result;
      return result;
    } catch (err) {
      return {
        success: false,
        content: null,
        error: `AI fallback failed: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      };
    }
  }

  if (!env.ai.apiKey) {
    return {
      success: false,
      content: null,
      error:
        "AI is not configured. Add AI_API_KEY (e.g. a Groq key) to enable AI features.",
    };
  }

  return {
    success: false,
    content: null,
    error: lastError
      ? `AI request failed: ${lastError}`
      : "AI service is temporarily unavailable. Please try again.",
  };
}

/** Utility: strip markdown code fences and parse JSON from an AI response. */
export function parseJsonFromAI<T = unknown>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
