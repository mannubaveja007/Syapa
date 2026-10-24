import dotenv from "dotenv";
import path from "node:path";
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export interface EmbeddingsOptions {
  timeoutMs?: number;
  retries?: number;
}

const REQUIRED_EMBED_DIM = 1024;

export class EmbeddingsClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private dimension: number;
  private defaultTimeout: number;

  constructor() {
    this.baseUrl = (process.env.EMBED_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    this.apiKey = process.env.EMBED_API_KEY || process.env.OPENROUTER_API_KEY || "";
    this.model = process.env.EMBED_MODEL || "openai/text-embedding-3-small";
    this.dimension = Number(process.env.EMBED_DIM) || REQUIRED_EMBED_DIM;
    this.defaultTimeout = 30000;

    // Fast-fail startup check: ensure EMBED_DIM equals 1024 (Prisma vector(1024))
    if (this.dimension !== REQUIRED_EMBED_DIM) {
      throw new Error(
        `[Embeddings Startup Error] EMBED_DIM is configured as ${this.dimension}, but PostgreSQL/Prisma requires exactly ${REQUIRED_EMBED_DIM} dimensions for vector(1024). Please set EMBED_DIM=1024.`
      );
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getModel(): string {
    return this.model;
  }

  getDimension(): number {
    return this.dimension;
  }

  /**
   * Truncates (or pads) a vector to targetDim and L2-normalizes it.
   */
  private normalizeToTargetDim(vec: number[], targetDim = REQUIRED_EMBED_DIM): number[] {
    let result: number[];
    if (vec.length >= targetDim) {
      result = vec.slice(0, targetDim);
    } else {
      result = new Array(targetDim).fill(0);
      for (let i = 0; i < vec.length; i++) {
        result[i] = vec[i];
      }
    }

    // L2-normalize
    let sumSquares = 0;
    for (let i = 0; i < result.length; i++) {
      sumSquares += result[i] * result[i];
    }
    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] = result[i] / norm;
      }
    }

    return result;
  }

  /**
   * Embeds a single text string into a vector of exactly 1024 dimensions.
   */
  async embed(text: string, options: EmbeddingsOptions = {}): Promise<number[]> {
    const results = await this.embedBatch([text], options);
    return results[0];
  }

  /**
   * Embeds multiple text strings in a single batched HTTP request.
   */
  async embedBatch(texts: string[], options: EmbeddingsOptions = {}): Promise<number[][]> {
    if (!texts.length) return [];

    const timeout = options.timeoutMs ?? this.defaultTimeout;
    const maxRetries = options.retries ?? 3;
    let attempt = 0;
    let lastError: any = null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      if (this.baseUrl.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        headers["X-Title"] = "Syapa";
      }
    }

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        console.log(`[Embeddings] Attempt ${attempt}: sending batched request for ${texts.length} items using ${this.model} at ${this.baseUrl}`);
        const bodyPayload: Record<string, any> = {
          model: this.model,
          input: texts.length === 1 ? texts[0] : texts,
        };
        // Ollama OpenAI-compatible endpoint throws 400 if dimensions exceeds model native length (e.g. 768 for nomic)
        if (!this.baseUrl.includes(":11434") && !this.baseUrl.includes("ollama")) {
          bodyPayload.dimensions = REQUIRED_EMBED_DIM;
        }

        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Embeddings HTTP ${response.status}: ${errBody}`);
        }

        const data = (await response.json()) as any;
        if (!data.data || !Array.isArray(data.data)) {
          throw new Error(`Unexpected embeddings response structure: ${JSON.stringify(data)}`);
        }

        // Sort data items by index
        const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        
        // Ensure every embedding is strictly 1024 dimensions and L2-normalized
        const embeddings = sorted.map((item) =>
          this.normalizeToTargetDim(item.embedding as number[], REQUIRED_EMBED_DIM)
        );

        return embeddings;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        console.warn(`[Embeddings] Error on attempt ${attempt}:`, err?.message || err);
        if (attempt <= maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 6000);
          await new Promise((res) => setTimeout(res, backoff));
        }
      }
    }

    throw new Error(`Embeddings failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }
}

export const embeddingsClient = new EmbeddingsClient();
