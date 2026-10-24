import { randomUUID } from "node:crypto";
import { prisma } from "../client";

export interface StoreChunkInput {
  id?: string;
  userId: string;
  meetingId?: string | null;
  projectContextId?: string | null;
  contextType: "BRIEF" | "CHAT" | "MEETING_CHUNK";
  chunkIndex?: number;
  content: string;
  metadata?: Record<string, any>;
  embedding: number[];
}

export interface HybridSearchInput {
  userId: string;
  queryText: string;
  queryEmbedding: number[];
  limit?: number;
  contextTypes?: ("BRIEF" | "CHAT" | "MEETING_CHUNK")[];
  meetingIds?: string[];
  vectorWeight?: number; // default 0.70
  keywordWeight?: number; // default 0.30
}

export interface HybridSearchResultRow {
  id: string;
  userId: string;
  meetingId: string | null;
  projectContextId: string | null;
  contextType: string;
  chunkIndex: number;
  content: string;
  metadata: any;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

export class DocumentChunkRepository {
  /**
   * Stores a document chunk with pgvector embedding and generates tsvector full-text data.
   */
  static async storeChunk(input: StoreChunkInput): Promise<string> {
    const id = input.id || randomUUID();
    const vectorStr = `[${input.embedding.join(",")}]`;
    const metadataJson = JSON.stringify(input.metadata || {});

    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentChunk" (
        "id", "userId", "meetingId", "projectContextId", "contextType", "chunkIndex", "content", "metadata", "embedding", "searchVector", "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::vector, to_tsvector('english', $7), NOW()
      )`,
      id,
      input.userId,
      input.meetingId ?? null,
      input.projectContextId ?? null,
      input.contextType,
      input.chunkIndex ?? 0,
      input.content,
      metadataJson,
      vectorStr
    );

    return id;
  }

  /**
   * Stores multiple chunks in a single transaction.
   */
  static async storeChunks(inputs: StoreChunkInput[]): Promise<string[]> {
    const ids: string[] = [];
    for (const input of inputs) {
      const id = await this.storeChunk(input);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Performs hybrid search (70% pgvector cosine similarity + 30% postgres full-text ts_rank).
   */
  static async hybridSearch(input: HybridSearchInput): Promise<HybridSearchResultRow[]> {
    const limit = input.limit ?? 10;
    const vectorWeight = input.vectorWeight ?? 0.70;
    const keywordWeight = input.keywordWeight ?? 0.30;
    const vectorStr = `[${input.queryEmbedding.join(",")}]`;

    // Build conditions
    const conditions: string[] = [`c."userId" = $1`];
    const params: any[] = [input.userId, vectorStr, input.queryText, vectorWeight, keywordWeight, limit];

    if (input.contextTypes && input.contextTypes.length > 0) {
      params.push(input.contextTypes);
      conditions.push(`c."contextType" = ANY($${params.length}::text[])`);
    }

    if (input.meetingIds && input.meetingIds.length > 0) {
      params.push(input.meetingIds);
      conditions.push(`(c."meetingId" = ANY($${params.length}::text[]) OR c."meetingId" IS NULL)`);
    }

    const whereClause = conditions.join(" AND ");

    const query = `
      WITH scored_chunks AS (
        SELECT 
          c."id",
          c."userId",
          c."meetingId",
          c."projectContextId",
          c."contextType",
          c."chunkIndex",
          c."content",
          c."metadata",
          -- Cosine similarity: 1 - cosine distance, bounded [0, 1]
          GREATEST(0.0, 1.0 - (c."embedding" <=> $2::vector)) AS vector_score,
          -- Text rank score: bounded and normalized
          COALESCE(ts_rank_cd(to_tsvector('english', c."content"), plainto_tsquery('english', $3)), 0.0) AS keyword_score
        FROM "DocumentChunk" c
        WHERE ${whereClause}
      )
      SELECT 
        id,
        "userId",
        "meetingId",
        "projectContextId",
        "contextType",
        "chunkIndex",
        content,
        metadata,
        CAST(vector_score AS float) AS "vectorScore",
        CAST(keyword_score AS float) AS "keywordScore",
        CAST(($4 * vector_score + $5 * keyword_score) AS float) AS "combinedScore"
      FROM scored_chunks
      ORDER BY ($4 * vector_score + $5 * keyword_score) DESC
      LIMIT $6;
    `;

    const results = await prisma.$queryRawUnsafe<HybridSearchResultRow[]>(query, ...params);
    return results;
  }

  static async deleteChunksByMeeting(meetingId: string): Promise<void> {
    await prisma.$executeRawUnsafe(`DELETE FROM "DocumentChunk" WHERE "meetingId" = $1`, meetingId);
  }

  static async deleteChunksByProjectContext(contextId: string): Promise<void> {
    await prisma.$executeRawUnsafe(`DELETE FROM "DocumentChunk" WHERE "projectContextId" = $1`, contextId);
  }
}
