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
}

export class LLMClient {
  private baseUrl: string;
  private model: string;
  private defaultTimeout: number;

  constructor() {
    this.baseUrl = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, "");
    this.model = process.env.LLM_MODEL || "gemma4:12b";
    this.defaultTimeout = Number(process.env.LLM_TIMEOUT_MS) || 60000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getModel(): string {
    return this.model;
  }

  async chatCompletion(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const timeout = options.timeoutMs ?? this.defaultTimeout;
    const maxRetries = options.retries ?? 2;
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        console.log(`[LLM] Attempt ${attempt}: calling ${this.baseUrl}/chat/completions with model ${this.model}`);
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`LLM HTTP ${response.status}: ${errBody}`);
        }

        const data = (await response.json()) as any;
        const reply = data.choices?.[0]?.message?.content ?? "";
        return reply.trim();
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        console.warn(`[LLM] Error on attempt ${attempt}:`, err?.message || err);
        if (attempt <= maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((res) => setTimeout(res, backoff));
        }
      }
    }

    throw new Error(`LLM failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Enforces structured JSON output matching a Zod schema with one automatic retry on schema mismatch.
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
      temperature: options.temperature ?? 0.2, // lower temperature for JSON
    });

    try {
      const parsed = this.cleanAndParseJson(rawReply);
      const validated = schema.parse(parsed);
      return validated;
    } catch (firstErr: any) {
      console.warn(`[LLM] Structured output validation failed: ${firstErr.message}. Attempting 1 repair retry...`);

      // Retry once by feeding the model its faulty output and the validation error
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
    // Strip markdown code fences if model enclosed JSON in ```json ... ```
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    // Find the outermost JSON object bounds if there is extraneous text
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  }
}

export const llmClient = new LLMClient();
