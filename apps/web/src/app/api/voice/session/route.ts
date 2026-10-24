import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { SimulationRepository, ProjectContextRepository, MeetingRepository } from "@syapa/db";

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWords(str: string, maxWords: number): string {
  const words = str.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return str;
  return words.slice(0, maxWords).join(" ") + "…";
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    persona = "Scope Creep Client",
    difficulty = 2,
    briefId,
    meetingId,
    customBrief = "",
  } = body;

  // Assemble grounded context
  let contextBrief = customBrief ? customBrief.trim() : "";

  if (briefId) {
    const doc = await ProjectContextRepository.getById(briefId, user.userId);
    if (doc?.content) {
      contextBrief = doc.content;
    }
  } else if (meetingId) {
    const meeting = await MeetingRepository.getMeetingById(meetingId, user.userId);
    if (meeting?.summary) {
      contextBrief = `Meeting context for “${meeting.title}”: ${meeting.summary}`;
      if (meeting.analysis?.summary) {
        contextBrief += ` Executive analysis: ${meeting.analysis.summary}`;
      }
    }
  }

  if (!contextBrief) {
    contextBrief =
      "Project: Full-stack SaaS redesign and API integration. Fixed budget: $6,000. Timeline: 4 weeks. Milestone 1 includes wireframes and responsive landing page. Milestone 2 covers user authentication and Stripe billing.";
  }

  // Ensure injected brief is strictly under 500 words
  const injectedBrief = truncateToWords(contextBrief, 450);

  const defaultHiddenAsks = [
    "Wants free native mobile app screens included in web scope",
    "Demands 2-week rush delivery with zero extra compensation",
    "Attempts to convert milestone payment into post-launch 60-day terms",
  ];

  // Create SimulationSession with channel: "VOICE"
  const session = await SimulationRepository.createSession({
    userId: user.userId,
    persona,
    difficulty: Number(difficulty) || 2,
    patience: 100,
    trust: 80,
    budgetCeiling: 6000,
    hiddenAsks: defaultHiddenAsks,
    briefId: briefId || undefined,
    meetingIds: meetingId ? [meetingId] : undefined,
    channel: "VOICE",
  });

  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  const elevenlabsAgentId = process.env.ELEVENLABS_AGENT_ID;

  let signedUrl: string | null = null;

  if (elevenlabsApiKey && elevenlabsAgentId) {
    try {
      const convRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${elevenlabsAgentId}`,
        {
          method: "GET",
          headers: {
            "xi-api-key": elevenlabsApiKey,
          },
        }
      );
      if (convRes.ok) {
        const data = await convRes.json();
        signedUrl = data.signed_url || null;
      } else {
        console.warn("[Voice Session] ElevenLabs signed URL request failed:", convRes.status);
      }
    } catch (err: any) {
      console.warn("[Voice Session] Error calling ElevenLabs convai:", err.message);
    }
  }

  return NextResponse.json({
    sessionId: session.id,
    channel: "VOICE",
    signedUrl,
    agentId: elevenlabsAgentId || "agent_bad_client_practice",
    brief: injectedBrief,
    briefWordCount: countWords(injectedBrief),
    isMock: !signedUrl,
  });
}
