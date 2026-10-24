import { NextRequest, NextResponse } from "next/server";
import { TranscriptBatchInputSchema } from "@syapa/shared";
import { MeetingRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

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

  const body = await req.json().catch(() => ({}));
  const parsed = TranscriptBatchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { segments } = parsed.data;
  await MeetingRepository.appendSegments({
    meetingId: params.id,
    segments,
  });

  return NextResponse.json({
    success: true,
    count: segments.length,
  });
}
