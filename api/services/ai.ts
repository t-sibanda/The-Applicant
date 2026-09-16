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
  temperature: number,
  json: boolean,
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
      temperature,
      // Reasoning models (e.g. gpt-oss) consume tokens "thinking"; give ample
      // budget so the visible answer isn't truncated.
      max_tokens: maxTokens,
      // Structured-output mode: forces the provider to emit valid JSON, which
      // removes most parse failures on extraction/scoring endpoints. Every
      // prompt that sets json already instructs the model to return JSON.
      ...(json ? { response_format: { type: "json_object" } } : {}),
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
 * Task tier for routing:
 * - "fast": high-volume, low-stakes calls (ATS scoring, quick scans,
 *   summaries, extraction). Uses the primary (cheap/fast) provider first.
 * - "quality": user-facing writing that is judged (resume tailoring, cover
 *   letters, the editing chat). Uses the quality provider first when
 *   configured, else the primary.
 * Omitting the task keeps the original behavior (primary then fallback).
 */
export type AITask = "fast" | "quality";

export interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

function primaryProvider(): ProviderConfig | null {
  return env.ai.apiKey
    ? { apiUrl: env.ai.apiUrl, apiKey: env.ai.apiKey, model: env.ai.model }
    : null;
}

function qualityProvider(): ProviderConfig | null {
  return env.ai.qualityApiKey && env.ai.qualityApiUrl
    ? { apiUrl: env.ai.qualityApiUrl, apiKey: env.ai.qualityApiKey, model: env.ai.qualityModel || env.ai.model }
    : null;
}

function fallbackProvider(): ProviderConfig | null {
  return env.ai.fallbackApiKey && env.ai.fallbackApiUrl
    ? { apiUrl: env.ai.fallbackApiUrl, apiKey: env.ai.fallbackApiKey, model: env.ai.fallbackModel || env.ai.model }
    : null;
}

/**
 * Pure ordering + de-duplication of a provider chain for a task. Extracted so
 * the routing logic is unit-testable without real env or network. Quality
 * tasks lead with the quality provider (when set); everything leads with the
 * primary. The fallback is always tried last. Duplicate providers (same
 * url+key+model) are removed so we never call the same one twice per request.
 */
export function orderProviders(
  task: AITask | undefined,
  providers: { primary: ProviderConfig | null; quality: ProviderConfig | null; fallback: ProviderConfig | null },
): ProviderConfig[] {
  const { primary, quality, fallback } = providers;
  const ordered: (ProviderConfig | null)[] =
    task === "quality" ? [quality ?? primary, primary, fallback] : [primary, fallback];

  const seen = new Set<string>();
  const chain: ProviderConfig[] = [];
  for (const p of ordered) {
    if (!p) continue;
    const key = `${p.apiUrl}|${p.apiKey}|${p.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chain.push(p);
  }
  return chain;
}

function providerChain(task?: AITask): ProviderConfig[] {
  return orderProviders(task, {
    primary: primaryProvider(),
    quality: qualityProvider(),
    fallback: fallbackProvider(),
  });
}

/**
 * Provider-agnostic chat completion with task-based routing and failover.
 * Never throws: always returns a structured AIResult.
 *
 * Options:
 * - task: "fast" or "quality" (see AITask). Selects which provider leads.
 * - model: override the model for the leading provider (rarely needed).
 * - temperature: defaults to 0.7 (writing). Pass 0-0.2 for extraction/scoring.
 * - json: enable provider JSON mode for endpoints that parse the response.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { task?: AITask; model?: string; maxTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<AIResult> {
  // Groq free tier caps total tokens-per-minute (input + output) at ~8000.
  // Keep the output budget modest so prompt + completion stays under the limit.
  const maxTokens = opts.maxTokens ?? 3000;
  const temperature = opts.temperature ?? 0.7;
  const json = opts.json ?? false;

  const chain = providerChain(opts.task);
  if (chain.length === 0) {
    return {
      success: false,
      content: null,
      error:
        "AI is not configured. Add AI_API_KEY (e.g. a Groq key) to enable AI features.",
    };
  }

  // Guard against oversized inputs: trim very long message content so the
  // input tokens + maxTokens stay under the free-tier TPM ceiling. ~4 chars ≈
  // 1 token; we cap total input characters to keep input under ~4000 tokens.
  const MAX_INPUT_CHARS = 16000;
  const trimmed = trimMessages(messages, MAX_INPUT_CHARS);

  let lastError: string | null = null;
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    // Honor an explicit model override only for the leading provider.
    const model = i === 0 && opts.model ? opts.model : p.model;
    try {
      const result = await callProvider(p.apiUrl, p.apiKey, model, trimmed, maxTokens, temperature, json);
      if (result.success) return result;
      lastError = result.error;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    content: null,
    error: lastError
      ? `AI request failed: ${lastError}`
      : "AI service is temporarily unavailable. Please try again.",
  };
}

/**
 * Resilient JSON extraction from an AI response. Handles:
 *  - markdown code fences
 *  - extra prose/reasoning around the JSON
 *  - the first balanced {...} object anywhere in the text
 */
export function parseJsonFromAI<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\n?/gi, "").replace(/```/g, "").trim();

  // Fast path: whole string is JSON.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to extraction
  }

  // Extract the first balanced JSON object.
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Vision completion: reads an image (screenshot) and returns text.
 *
 * Uses the OpenAI-compatible multimodal message format, which Groq's vision
 * models accept. The image is passed as a data URL or a public URL. Never
 * throws; returns a structured AIResult. If no AI key is configured, returns a
 * clear, honest error so the caller can fall back to manual paste.
 */
export async function visionCompletion(args: {
  imageUrl: string; // data URL (data:image/png;base64,...) or https URL
  prompt: string;
  maxTokens?: number;
}): Promise<AIResult> {
  if (!env.ai.apiKey) {
    return {
      success: false,
      content: null,
      error: "Image reading is not configured. Paste the text instead, or add AI_API_KEY.",
    };
  }

  const body = {
    model: env.ai.visionModel || env.ai.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: args.prompt },
          { type: "image_url", image_url: { url: args.imageUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: args.maxTokens ?? 1500,
  };

  try {
    const response = await fetch(env.ai.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ai.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        content: null,
        error: `Vision provider error ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return content
      ? { success: true, content, error: null }
      : { success: false, content: null, error: "The image could not be read." };
  } catch (err) {
    return {
      success: false,
      content: null,
      error: `Vision request failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
