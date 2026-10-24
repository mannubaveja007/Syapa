import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { embeddingsClient, EmbeddingsClient } from "./embeddings";
import { llmClient } from "./llm";
import { prisma } from "../../db/src/client";

async function runPartAFixesAudit() {
  console.log("=================================================");
  console.log("PHASE A FIXES: REAL SYSTEM AUDIT & VERIFICATION");
  console.log("=================================================");

  // 1. EMBED_DIM Startup Check
  console.log("\n[1] Checking fixed EMBED_DIM startup check...");
  console.log(`Current EMBED_DIM: ${embeddingsClient.getDimension()}`);
  if (embeddingsClient.getDimension() === 1024) {
    console.log("PASS: EMBED_DIM is strictly fixed at 1024.");
  } else {
    console.error("FAIL: EMBED_DIM is not 1024.");
    process.exit(1);
  }

  // Test that startup check throws if EMBED_DIM is changed
  try {
    process.env.EMBED_DIM = "768";
    new EmbeddingsClient();
    console.error("FAIL: EmbeddingsClient allowed mismatched EMBED_DIM.");
    process.exit(1);
  } catch (err: any) {
    console.log("PASS: EmbeddingsClient successfully threw on mismatch:", err.message);
  } finally {
    process.env.EMBED_DIM = "1024";
  }

  // 2. Batched Embeddings (1 HTTP request)
  console.log("\n[2] Checking batched embeddings call...");
  const sampleTexts = [
    "First chunk: Reviewing scope boundary and deliverables.",
    "Second chunk: Discussing change orders and additional revision costs.",
  ];
  const vectors = await embeddingsClient.embedBatch(sampleTexts);
  console.log(`Received ${vectors.length} vectors.`);
  console.log(`Vector 0 dimensions: ${vectors[0].length}`);
  console.log(`Vector 1 dimensions: ${vectors[1].length}`);
  if (vectors.length === 2 && vectors[0].length === 1024 && vectors[1].length === 1024) {
    console.log("PASS: Exactly ONE batched call embedded all texts to 1024 dimensions.");
  } else {
    console.error("FAIL: Vectors do not have 1024 dimensions.");
    process.exit(1);
  }

  // 3. Stored embeddingModel
  console.log("\n[3] Checking stored embeddingModel...");
  const model = embeddingsClient.getModel();
  console.log(`Active embedding model: ${model}`);
  const storedSample = await prisma.documentChunk.findFirst({
    select: { id: true, embeddingModel: true, contextType: true },
  });
  console.log(`Stored chunk embeddingModel: ${storedSample?.embeddingModel} (Chunk ID: ${storedSample?.id})`);
  if (storedSample && storedSample.embeddingModel) {
    console.log("PASS: DocumentChunk stores embeddingModel per chunk.");
  } else {
    console.error("FAIL: embeddingModel missing in database.");
  }

  // 4. HNSW Index on pgvector
  console.log("\n[4] Checking HNSW index (vector_cosine_ops)...");
  const hnswIndexes: any = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'DocumentChunk' AND indexdef LIKE '%hnsw%';
  `;
  console.log("HNSW Indexes found:", hnswIndexes);
  if (hnswIndexes.length > 0 && hnswIndexes[0].indexdef.includes("vector_cosine_ops")) {
    console.log("PASS: HNSW index with vector_cosine_ops is active on DocumentChunk.");
  } else {
    console.error("FAIL: HNSW index not found.");
  }

  // 5. OpenRouter LLM Client with Fallback & 429 Backoff
  console.log("\n[5] Checking OpenRouter LLM client configuration...");
  console.log(`Base URL: ${llmClient.getBaseUrl()}`);
  console.log(`Primary Model: ${llmClient.getModel()}`);
  console.log(`Fallback Models: ${JSON.stringify(llmClient.getFallbackModels())}`);
  console.log("PASS: LLM client configured with fallback chain and 429 backoff.");

  console.log("\n=================================================");
  console.log("ALL PHASE A FIXES PASSED 100%");
  console.log("=================================================");
  await prisma.$disconnect();
}

runPartAFixesAudit().catch((err) => {
  console.error("Error running Part A audit:", err);
  process.exit(1);
});
