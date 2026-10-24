import { NextRequest, NextResponse } from "next/server";
import { MeetingRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-token",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = params.id;
    const meeting = await MeetingRepository.getMeetingById(meetingId);

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const summary = meeting.summary || meeting.analysis?.summary || "";
    const suggestions = meeting.analysis?.suggestions || [];

    return NextResponse.json(
      {
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        summary,
        actionItems: meeting.actionItems || meeting.analysis?.actionItems || [],
        analysis: {
          summary,
          actionItems: meeting.actionItems || meeting.analysis?.actionItems || [],
          requestedWork: meeting.requestedWork || meeting.analysis?.requestedWork || [],
          riskyCommitments: meeting.riskyCommitments || meeting.analysis?.riskyCommitments || [],
          patterns: meeting.analysis?.patterns || [],
          suggestions: suggestions.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            category: s.category,
            exactQuote: s.exactQuote,
            recommendedAction: s.recommendedAction,
            priority: s.priority,
          })),
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Analysis API] Error fetching meeting analysis:", err);
    return NextResponse.json(
      { error: "Failed to retrieve meeting analysis" },
      { status: 500, headers: corsHeaders }
    );
  }
}
