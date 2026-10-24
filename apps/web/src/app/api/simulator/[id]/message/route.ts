import { NextRequest, NextResponse } from "next/server";
import { SendSimulationMessageInputSchema, BadClientTurnOutputSchema } from "@syapa/shared";
import { SimulationRepository, DocumentChunkRepository } from "@syapa/db";
import { llmClient, embeddingsClient } from "@syapa/ai";
import { authenticateRequest } from "@/lib/auth";

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

  if (session.status === "COMPLETED") {
    return NextResponse.json({ error: "Simulation session is already completed" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = SendSimulationMessageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { message: userMessage } = parsed.data;
  const currentTurnIndex = session.turns.length;

  // 1. Record user turn
  await SimulationRepository.addTurn({
    sessionId: session.id,
    role: "user",
    content: userMessage,
    turnIndex: currentTurnIndex,
  });

  // 2. Retrieve grounded context using hybrid search (~70% vector, 30% keyword)
  let groundedSnippets: string[] = [];
  try {
    const queryEmbedding = await embeddingsClient.embed(userMessage);
    const meetingIds = Array.isArray(session.meetingIds) ? (session.meetingIds as string[]) : [];

    const searchResults = await DocumentChunkRepository.hybridSearch({
      userId: user.userId,
      queryText: userMessage,
      queryEmbedding,
      limit: 4,
      meetingIds: meetingIds.length > 0 ? meetingIds : undefined,
      vectorWeight: 0.70,
      keywordWeight: 0.30,
    });

    groundedSnippets = searchResults.map(
      (r, idx) => `[Source Passage ${idx + 1} (${r.contextType})]:\n${r.content}`
    );
  } catch (err) {
    console.warn("[Simulator] Hybrid retrieval warning:", err);
  }

  const contextText = groundedSnippets.length > 0
    ? groundedSnippets.join("\n\n")
    : "No prior documents found for this client. Act based solely on the current negotiation thread.";

  // 3. Assemble prompt for Gemma 4
  const conversationHistory = [...session.turns, { role: "user", content: userMessage }]
    .map((t) => `${t.role === "user" ? "Freelancer" : "Bad Client"}: ${t.content}`)
    .join("\n");

  const systemPrompt = `You are a difficult, demanding freelance client in a negotiation simulation.
PERSONA: ${session.persona.toUpperCase()}
DIFFICULTY LEVEL: ${session.difficulty} / 3

CURRENT HIDDEN STATE (Strictly confidential, never mention these numbers directly):
- Patience (0-100): ${session.patience}
- Trust (0-100): ${session.trust}
- Budget Ceiling: $${session.budgetCeiling}
- Sneaky Hidden Asks remaining to push:
${JSON.stringify(session.hiddenAsks, null, 2)}

GROUNDED CONTEXT RULES:
1. You ONLY know what is stated in the Grounded Context below.
2. Push hard on ambiguities and gaps using the client's actual words and requirements.
3. If the freelancer defends their rate with clear value and boundaries, your trust goes UP (+3 to +10) and patience drops slightly (-2 to -5).
4. If the freelancer makes concessions without charging or gives vague promises ("I'll try my best"), you aggressively exploit it, lower your respect/trust, and sneak in one of your hidden asks.
5. If your patience reaches 0, you become terse and threaten to walk away.

GROUNDED CONTEXT:
${contextText}

Provide your response in JSON matching the schema:
{
  "reply": "Your conversational dialogue to the freelancer",
  "hiddenStateDelta": {
    "patienceDelta": number between -20 and +20,
    "trustDelta": number between -20 and +20,
    "hiddenAsksRevealed": ["any hidden ask you introduced or reinforced in this turn"]
  }
}`;

  const userPrompt = `Negotiation transcript so far:\n${conversationHistory}\n\nRespond as the Bad Client. Return ONLY the JSON object.`;

  // 4. Generate structured Bad Client response
  const clientResponse = await llmClient.structuredOutput(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    BadClientTurnOutputSchema,
    "BadClientTurnOutputSchema"
  );

  // 5. Update hidden state in DB
  const newPatience = Math.max(0, Math.min(100, session.patience + (clientResponse.hiddenStateDelta.patienceDelta || 0)));
  const newTrust = Math.max(0, Math.min(100, session.trust + (clientResponse.hiddenStateDelta.trustDelta || 0)));

  await SimulationRepository.updateHiddenState(session.id, newPatience, newTrust);

  // 6. Record Bad Client turn in DB
  const clientTurn = await SimulationRepository.addTurn({
    sessionId: session.id,
    role: "client",
    content: clientResponse.reply,
    turnIndex: currentTurnIndex + 1,
    hiddenStateDelta: clientResponse.hiddenStateDelta,
    rawResponse: clientResponse,
  });

  return NextResponse.json({
    reply: clientResponse.reply,
    turnIndex: clientTurn.turnIndex,
    createdAt: clientTurn.createdAt,
  });
}
