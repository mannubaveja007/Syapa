import { NextRequest, NextResponse } from "next/server";
import { CreateMeetingInputSchema } from "@syapa/shared";
import { MeetingRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await MeetingRepository.listMeetingsByUser(user.userId);
  return NextResponse.json({ meetings });
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateMeetingInputSchema.safeParse(body);
  const title = parsed.success ? parsed.data.title : "Untitled Meeting";

  const meeting = await MeetingRepository.createMeeting({
    userId: user.userId,
    title,
  });

  return NextResponse.json({ meeting }, { status: 201 });
}
