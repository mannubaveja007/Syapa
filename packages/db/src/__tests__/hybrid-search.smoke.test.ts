import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../client.js";
import { DocumentChunkRepository } from "../repositories/chunk.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { embeddingsClient } from "../../../ai/src/index.js";
import { verifyQuoteInSource, verifyAndFilterQuotes } from "../../../ai/src/index.js";

describe("Phase 1 Smoke Test: Embed, Store, and Hybrid Search", () => {
  let testUserId: string;
  const testEmail = `smoke_test_${Date.now()}@example.com`;
  const sampleText = "The client explicitly requested delivery of the complete dashboard redesign by Friday afternoon.";

  beforeAll(async () => {
    // 1. Create a test user
    const user = await UserRepository.createUser({
      name: "Smoke Test User",
      email: testEmail,
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  it("should embed a string, store it in PostgreSQL with pgvector, and retrieve by hybrid search", async () => {
    // 1. Embed text
    const embedding = await embeddingsClient.embed(sampleText);
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);

    // 2. Store chunk with pgvector embedding and tsvector
    const chunkId = await DocumentChunkRepository.storeChunk({
      userId: testUserId,
      contextType: "BRIEF",
      content: sampleText,
      embedding,
      metadata: { source: "smoke_test" },
    });
    expect(chunkId).toBeDefined();

    // 3. Query embedding for search
    const query = "dashboard redesign delivery deadline";
    const queryEmbedding = await embeddingsClient.embed(query);

    // 4. Hybrid search (70% vector + 30% keyword)
    const results = await DocumentChunkRepository.hybridSearch({
      userId: testUserId,
      queryText: query,
      queryEmbedding,
      limit: 5,
      vectorWeight: 0.70,
      keywordWeight: 0.30,
    });

    expect(results.length).toBeGreaterThan(0);
    const topResult = results[0];
    expect(topResult.id).toBe(chunkId);
    expect(topResult.content).toBe(sampleText);
    expect(topResult.vectorScore).toBeGreaterThan(0);
    expect(topResult.combinedScore).toBeGreaterThan(0);
  });

  it("should verify quotes deterministically in plain code", () => {
    const transcript = "We agreed on $5,000 upfront and another $5,000 upon staging deployment. Revisions are capped at two rounds.";
    
    // Existing quote
    expect(verifyQuoteInSource("Revisions are capped at two rounds", transcript)).toBe(true);
    
    // Non-existent quote
    expect(verifyQuoteInSource("Unlimited revisions for 6 months", transcript)).toBe(false);

    // Filter list
    const items = [
      { task: "Cap revisions", quote: "Revisions are capped at two rounds" },
      { task: "Free maintenance", quote: "We will maintain your servers forever for free" },
    ];
    const { verified, dropped, droppedCount } = verifyAndFilterQuotes(items, transcript);

    expect(verified.length).toBe(1);
    expect(verified[0].task).toBe("Cap revisions");
    expect(dropped.length).toBe(1);
    expect(droppedCount).toBe(1);
  });
});
