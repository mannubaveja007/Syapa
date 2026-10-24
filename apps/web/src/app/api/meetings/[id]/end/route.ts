import { NextRequest, NextResponse } from "next/server";
import { MeetingRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";
import { processMeetingEnded } from "@/lib/pipeline";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await MeetingRepository.getMeetingById(params.id, user.userId);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Trigger post-meeting processing pipeline in background
  processMeetingEnded(params.id, user.userId).catch((err) => {
    console.error("[POST /api/meetings/[id]/end] Background pipeline error:", err);
  });

  return NextResponse.json({
    message: "Meeting ended. Post-meeting pipeline initiated.",
    meetingId: params.id,
    status: "PROCESSING",
  });
}
