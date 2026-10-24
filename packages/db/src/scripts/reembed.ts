import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../client";
import { DocumentChunkRepository } from "../repositories/chunk.repository";
import { embeddingsClient } from "../../../ai/src/embeddings";

async function reembed() {
  const currentModel = process.env.EMBED_MODEL || "openai/text-embedding-3-small";
  console.log(`[Re-embed] Target embedding model: ${currentModel}`);

  const chunks = await DocumentChunkRepository.listAllChunks();
  console.log(`[Re-embed] Found ${chunks.length} total chunks in database.`);

  const outdated = chunks.filter((c) => c.embeddingModel !== currentModel);
  console.log(`[Re-embed] Found ${outdated.length} chunks needing re-embedding to ${currentModel}.`);

  if (outdated.length === 0) {
    console.log("[Re-embed] All chunks are already up-to-date with current model.");
    await prisma.$disconnect();
    return;
  }

  // Batch process in groups of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < outdated.length; i += BATCH_SIZE) {
    const batch = outdated.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    console.log(`[Re-embed] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} chunks)...`);
    const newEmbeddings = await embeddingsClient.embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      await DocumentChunkRepository.updateChunkEmbedding(
        batch[j].id,
        newEmbeddings[j],
        currentModel
      );
    }
  }

  console.log(`[Re-embed] Successfully re-embedded ${outdated.length} chunks!`);
  await prisma.$disconnect();
}

reembed().catch((err) => {
  console.error("[Re-embed] Error during re-embedding:", err);
  process.exit(1);
});
