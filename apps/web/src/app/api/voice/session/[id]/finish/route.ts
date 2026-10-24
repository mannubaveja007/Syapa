import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { SimulationRepository } from "@syapa/db";
import { llmClient } from "@syapa/ai";
import { ScorecardSchema } from "@syapa/shared";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await SimulationRepository.getSession(params.id, user.userId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { elevenlabsConversationId, turns = [] } = body;

  // Update elevenlabsConversationId if provided
  if (elevenlabsConversationId) {
    await SimulationRepository.updateVoiceSession(session.id, elevenlabsConversationId);
  }

  // Persist turns if provided
  if (Array.isArray(turns) && turns.length > 0) {
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      await SimulationRepository.addTurn({
        sessionId: session.id,
        role: turn.role === "user" ? "user" : "client",
        content: turn.content || turn.message || "",
        turnIndex: i + 1,
      });
    }
  }

  // Reload session with all turns
  const updatedSession = await SimulationRepository.getSession(session.id, user.userId);
  const sessionTurns = updatedSession?.turns || [];

  // If scorecard already exists, return it
  if (updatedSession?.scorecard) {
    return NextResponse.json({ scorecard: updatedSession.scorecard, sessionId: session.id });
  }

  // Generate Scorecard via LLM
  const transcript =
    sessionTurns.length > 0
      ? sessionTurns
          .map((t) => `[Turn ${t.turnIndex}] ${t.role === "user" ? "Freelancer" : "Bad Client"}: ${t.content}`)
          .join("\n\n")
      : "No dialogue recorded during session.";

  const systemPrompt = `You are a ruthless, expert negotiation coach analyzing a freelancer's verbal negotiation performance in a voice simulation against a difficult bad client.
Review the conversation turns carefully. Every single critique or praise item MUST cite the exact turnIndex and quote the freelancer's actual words.

You must output a JSON object adhering to this schema:
{
  "overallScore": number between 0 and 100,
  "summary": "2-3 sentence overview of how well the freelancer held ground, managed scope, and preserved pricing power.",
  "freeConcessions": [
    {
      "quote": "Freelancer's exact quote where they caved or gave free work",
      "turnIndex": integer turn number,
      "critique": "Why giving this away weakened their position"
    }
  ],
  "boundariesHeld": [
    {
      "quote": "Freelancer's exact quote where they defended rates, scope, or timeline",
      "turnIndex": integer turn number,
      "praise": "Why this firm stance was effective"
    }
  ],
  "priceAnchoring": {
    "initialOffer": "Summary of pricing discussed",
    "finalAgreed": "Where the price landed or status",
    "rating": "Strong" | "Moderate" | "Weak",
    "notes": "Evaluation of how well freelancer anchored their pricing"
  },
  "vaguePromises": [
    {
      "quote": "Freelancer's quote containing wishy-washy language",
      "turnIndex": integer turn number,
      "risk": "How the client can weaponize this ambiguity"
    }
  ],
  "rewrites": [
    {
      "turnIndex": integer turn number,
      "originalReply": "The weak statement made",
      "recommendedRewrite": "High-leverage, assertive professional response",
      "rationale": "Why this rewrite wins the negotiation"
    }
  ]
}`;

  const userPrompt = `Here is the voice negotiation transcript:\n\n${transcript}\n\nEvaluate and generate the scorecard. Return ONLY JSON.`;

  const scorecardData = await llmClient.structuredOutput(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ScorecardSchema,
    "ScorecardSchema"
  );

  const scorecard = await SimulationRepository.saveScorecard({
    sessionId: session.id,
    userId: user.userId,
    overallScore: scorecardData.overallScore,
    summary: scorecardData.summary,
    freeConcessions: scorecardData.freeConcessions,
    boundariesHeld: scorecardData.boundariesHeld,
    priceAnchoring: scorecardData.priceAnchoring,
    vaguePromises: scorecardData.vaguePromises,
    rewrites: scorecardData.rewrites,
  });

  await SimulationRepository.completeSession(session.id);

  return NextResponse.json({ scorecard, sessionId: session.id }, { status: 201 });
}
