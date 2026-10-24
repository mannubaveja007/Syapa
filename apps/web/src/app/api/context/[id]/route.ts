import { NextRequest, NextResponse } from "next/server";
import { ProjectContextRepository, DocumentChunkRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await DocumentChunkRepository.deleteChunksByProjectContext(params.id);
  await ProjectContextRepository.deleteContext(params.id, user.userId);

  return NextResponse.json({ success: true });
}
