import dotenv from "dotenv";
import path from "node:path";
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { z } from "zod";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
  callType?: "MEETING_ANALYSIS" | "SIMULATION_TURN" | "SCORECARD" | "EMBEDDINGS";
  onUsage?: (usage: {
    model: string;
    provider: string;
    callType: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    cost: number;
  }) => Promise<unknown> | unknown;
}

// Global FIFO Mutex for serialized execution of :free models to prevent OpenRouter 429s
class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const execute = () => {
        this.locked = true;
        resolve(() => {
          this.locked = false;
          const next = this.queue.shift();
          if (next) next();
        });
      };

      if (!this.locked) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}

const freeModelMutex = new AsyncMutex();

export class LLMClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private fallbackModels: string[];
  private defaultTimeout: number;

  constructor() {
    this.baseUrl = (process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    this.apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "";
    this.model = process.env.LLM_MODEL || "google/gemma-2-9b-it:free";
    const fallbacks = process.env.LLM_FALLBACK_MODELS || "meta-llama/llama-3.3-70b-instruct:free,mistralai/mistral-7b-instruct:free";
    this.fallbackModels = fallbacks.split(",").map((m) => m.trim()).filter(Boolean);
    this.defaultTimeout = Number(process.env.LLM_TIMEOUT_MS) || 90000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getModel(): string {
    return this.model;
  }

  getFallbackModels(): string[] {
    return this.fallbackModels;
  }

  private isFreeModel(modelName: string): boolean {
    return modelName.toLowerCase().includes(":free");
  }

  async chatCompletion(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const modelsToTry = [this.model, ...this.fallbackModels];
    let lastError: any = null;

    for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
      const currentModel = modelsToTry[mIdx];
      const isFree = this.isFreeModel(currentModel);
      const maxRetries = options.retries ?? 3;
      let attempt = 0;

      while (attempt <= maxRetries) {
        attempt++;
        let releaseMutex: (() => void) | null = null;
        if (isFree) {
          releaseMutex = await freeModelMutex.acquire();
        }

        const controller = new AbortController();
        const timeout = options.timeoutMs ?? this.defaultTimeout;
        const timer = setTimeout(() => controller.abort(), timeout);
        const startTime = Date.now();

        try {
          console.log(`[LLM] Model [${currentModel}] Attempt ${attempt}: calling ${this.baseUrl}/chat/completions`);

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
          }
          if (this.baseUrl.includes("openrouter.ai")) {
            headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            headers["X-Title"] = "Syapa";
          }

          const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: currentModel,
              messages,
              temperature: options.temperature ?? 0.7,
              max_tokens: options.maxTokens,
            }),
            signal: controller.signal,
          });

          clearTimeout(timer);
          const latencyMs = Date.now() - startTime;

          // Handle 429 Rate Limit with exponential backoff
          if (response.status === 429) {
            const retryAfterHeader = response.headers.get("retry-after");
            const waitTime = retryAfterHeader ? Number(retryAfterHeader) * 1000 : Math.min(2000 * Math.pow(2, attempt), 10000);
            console.warn(`[LLM 429 Rate Limit] Model ${currentModel} returned 429. Backing off for ${waitTime}ms...`);
            if (releaseMutex) {
              releaseMutex();
              releaseMutex = null;
            }
            await new Promise((res) => setTimeout(res, waitTime));
            continue;
          }

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`LLM HTTP ${response.status}: ${errBody}`);
          }

          const data = (await response.json()) as any;
          const reply = data.choices?.[0]?.message?.content ?? "";

          // Track usage if onUsage callback provided
          if (options.onUsage && data.usage) {
            const promptTokens = data.usage.prompt_tokens || 0;
            const completionTokens = data.usage.completion_tokens || 0;
            const totalTokens = data.usage.total_tokens || (promptTokens + completionTokens);
            const provider = this.baseUrl.includes("openrouter.ai") ? "openrouter" : "ollama";

            // Estimate cost ($0 for free/local)
            const cost = isFree || provider === "ollama" ? 0 : (promptTokens * 0.00000015 + completionTokens * 0.0000006);

            try {
              await options.onUsage({
                model: currentModel,
                provider,
                callType: options.callType || "MEETING_ANALYSIS",
                promptTokens,
                completionTokens,
                totalTokens,
                latencyMs,
                cost,
              });
            } catch (usageErr) {
              console.warn("[LLM] Usage logging callback error:", usageErr);
            }
          }

          if (releaseMutex) {
            releaseMutex();
            releaseMutex = null;
          }

          return reply.trim();
        } catch (err: any) {
          clearTimeout(timer);
          if (releaseMutex) {
            releaseMutex();
            releaseMutex = null;
          }
          lastError = err;
          console.warn(`[LLM Error] Model ${currentModel} attempt ${attempt} failed:`, err?.message || err);

          if (attempt <= maxRetries) {
            const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 6000);
            await new Promise((res) => setTimeout(res, backoff));
          }
        }
      }

      console.warn(`[LLM] Model ${currentModel} exhausted retries. Falling back to next model...`);
    }

    throw new Error(`All LLM models failed [${modelsToTry.join(", ")}]: ${lastError?.message}`);
  }

  /**
   * Enforces structured JSON output matching a Zod schema with repair retry.
   */
  async structuredOutput<T>(
    messages: LLMMessage[],
    schema: z.ZodType<T>,
    schemaName = "ResponseSchema",
    options: LLMOptions = {}
  ): Promise<T> {
    const schemaInstruction = `You must return ONLY a valid JSON object strictly complying with this format:\n${schemaName}. Do not include markdown codeblocks, explanation, or any other text. Output pure JSON only.`;

    const enrichedMessages: LLMMessage[] = [
      ...messages,
      {
        role: "system",
        content: schemaInstruction,
      },
    ];

    let rawReply = await this.chatCompletion(enrichedMessages, {
      ...options,
      temperature: options.temperature ?? 0.2,
    });

    try {
      const parsed = this.cleanAndParseJson(rawReply);
      const validated = schema.parse(parsed);
      return validated;
    } catch (firstErr: any) {
      console.warn(`[LLM] Structured output validation failed: ${firstErr.message}. Attempting 1 repair retry...`);

      const retryMessages: LLMMessage[] = [
        ...enrichedMessages,
        { role: "assistant", content: rawReply },
        {
          role: "user",
          content: `Your previous output did not match the required schema: ${firstErr.message}.\nHere is what you output:\n${rawReply}\n\nPlease fix the JSON and return ONLY the valid corrected JSON object.`,
        },
      ];

      const repairedReply = await this.chatCompletion(retryMessages, {
        ...options,
        temperature: 0.1,
      });

      const secondParsed = this.cleanAndParseJson(repairedReply);
      const secondValidated = schema.parse(secondParsed);
      return secondValidated;
    }
  }

  private cleanAndParseJson(text: string): any {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  }
}

export const llmClient = new LLMClient();
