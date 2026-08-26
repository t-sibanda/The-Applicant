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
  const maxTokens = opts.maxTokens ?? 6000;

  if (env.ai.apiKey) {
    try {
      const result = await callProvider(
        env.ai.apiUrl,
        env.ai.apiKey,
        opts.model || env.ai.model,
        messages,
        maxTokens,
      );
      if (result.success) return result;
      // fall through to fallback provider
    } catch (err) {
      // fall through
      void err;
    }
  }

  if (env.ai.fallbackApiKey && env.ai.fallbackApiUrl) {
    try {
      const result = await callProvider(
        env.ai.fallbackApiUrl,
        env.ai.fallbackApiKey,
        env.ai.fallbackModel || env.ai.model,
        messages,
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
    error: "AI service is temporarily unavailable. Please try again.",
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
