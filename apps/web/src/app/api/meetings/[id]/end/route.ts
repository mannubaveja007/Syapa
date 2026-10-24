import { NextRequest, NextResponse } from "next/server";
import { MeetingRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";
import { queueMeetingProcessing } from "@/lib/pipeline";

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

  // Queue post-meeting processing pipeline in background FIFO queue
  queueMeetingProcessing(params.id, user.userId);

  return NextResponse.json({
    message: "Meeting ended. Post-meeting pipeline initiated.",
    meetingId: params.id,
    status: "PROCESSING",
  });
}
