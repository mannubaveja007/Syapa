import { NextRequest, NextResponse } from "next/server";
import { UploadContextInputSchema } from "@syapa/shared";
import { ProjectContextRepository, DocumentChunkRepository } from "@syapa/db";
import { chunkText, embeddingsClient } from "@syapa/ai";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contexts = await ProjectContextRepository.listByUser(user.userId);
  return NextResponse.json({ contexts });
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UploadContextInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { title, type, content, metadata } = parsed.data;

  // 1. Create context record
  const context = await ProjectContextRepository.createContext({
    userId: user.userId,
    title,
    type,
    content,
    metadata,
  });

  // 2. Chunk text (~350 words, 50 overlap)
  const chunks = chunkText(content, 350, 50);

  // 3. Embed chunks in batch
  const embeddings = await embeddingsClient.embedBatch(chunks);

  // 4. Store chunks with pgvector
  for (let i = 0; i < chunks.length; i++) {
    await DocumentChunkRepository.storeChunk({
      userId: user.userId,
      projectContextId: context.id,
      contextType: type,
      chunkIndex: i,
      content: chunks[i],
      metadata: { title, type, chunkIndex: i },
      embedding: embeddings[i],
    });
  }

  return NextResponse.json({
    context,
    chunksCount: chunks.length,
  }, { status: 201 });
}
