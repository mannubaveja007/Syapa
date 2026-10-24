import { NextRequest, NextResponse } from "next/server";
import { SimulationRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

export async function GET(
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

  // Hide secret state from user unless the session is completed and scorecard is generated
  const isCompleted = session.status === "COMPLETED";

  return NextResponse.json({
    id: session.id,
    persona: session.persona,
    difficulty: session.difficulty,
    status: session.status,
    createdAt: session.createdAt,
    turns: session.turns.map((t) => ({
      id: t.id,
      role: t.role,
      content: t.content,
      turnIndex: t.turnIndex,
      createdAt: t.createdAt,
    })),
    scorecard: session.scorecard,
    ...(isCompleted
      ? {
          revealedHiddenState: {
            finalPatience: session.patience,
            finalTrust: session.trust,
            budgetCeiling: session.budgetCeiling,
            hiddenAsks: session.hiddenAsks,
          },
        }
      : {}),
  });
}
