export interface EmbeddingsOptions {
  timeoutMs?: number;
  retries?: number;
}

export class EmbeddingsClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private dimension: number;
  private defaultTimeout: number;

  constructor() {
    this.baseUrl = (process.env.EMBED_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, "");
    this.apiKey = process.env.EMBED_API_KEY || "";
    this.model = process.env.EMBED_MODEL || "nomic-embed-text";
    this.dimension = Number(process.env.EMBED_DIM) || 768;
    this.defaultTimeout = 30000;
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
   * Embeds a single text string into a vector.
   */
  async embed(text: string, options: EmbeddingsOptions = {}): Promise<number[]> {
    const results = await this.embedBatch([text], options);
    return results[0];
  }

  /**
   * Embeds multiple text strings in batch.
   */
  async embedBatch(texts: string[], options: EmbeddingsOptions = {}): Promise<number[][]> {
    if (!texts.length) return [];

    const timeout = options.timeoutMs ?? this.defaultTimeout;
    const maxRetries = options.retries ?? 2;
    let attempt = 0;
    let lastError: any = null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        console.log(`[Embeddings] Attempt ${attempt}: embedding ${texts.length} items with ${this.model} at ${this.baseUrl}`);
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: this.model,
            input: texts.length === 1 ? texts[0] : texts,
          }),
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

        // Sort data items by index if present
        const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        const embeddings = sorted.map((item) => item.embedding as number[]);

        // Update dimension if discovered
        if (embeddings[0] && embeddings[0].length !== this.dimension) {
          this.dimension = embeddings[0].length;
        }

        return embeddings;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        console.warn(`[Embeddings] Error on attempt ${attempt}:`, err?.message || err);
        if (attempt <= maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((res) => setTimeout(res, backoff));
        }
      }
    }

    throw new Error(`Embeddings failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }
}

export const embeddingsClient = new EmbeddingsClient();
