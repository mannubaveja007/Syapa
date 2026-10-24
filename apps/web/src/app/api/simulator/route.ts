import { NextRequest, NextResponse } from "next/server";
import { CreateSimulationInputSchema } from "@syapa/shared";
import { SimulationRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

const PERSONA_CONFIGS: Record<string, {
  basePatience: number;
  baseTrust: number;
  baseBudget: number;
  hiddenAsks: string[];
}> = {
  scope_creeper: {
    basePatience: 80,
    baseTrust: 70,
    baseBudget: 4500,
    hiddenAsks: [
      "Add custom native mobile support alongside responsive web without extra cost",
      "Include a complete multi-tier role-based admin analytics panel",
      "Demand free ongoing maintenance and bug fixes for the next 6 months",
    ],
  },
  budget_haggler: {
    basePatience: 65,
    baseTrust: 50,
    baseBudget: 2800,
    hiddenAsks: [
      "Demand a 30% rate cut citing 'future high-volume referrals'",
      "Insist third-party API and hosting fees be deducted from your fee",
      "Split the final payout into three 60-day delayed milestone tranches",
    ],
  },
  ghost_payer: {
    basePatience: 55,
    baseTrust: 40,
    baseBudget: 3500,
    hiddenAsks: [
      "Refuse the standard 50% upfront deposit before deliverables are previewed",
      "Demand raw uncompiled source code and Figma files before final invoice payment",
      "Stall milestones claiming finance committee sign-off is required",
    ],
  },
  micromanager: {
    basePatience: 45,
    baseTrust: 30,
    baseBudget: 5500,
    hiddenAsks: [
      "Demand mandatory daily 8:30 AM video standups and constant Slack availability",
      "Require line-by-line code review approval before any staging deploy",
      "Ask for automated time-tracking screenshots with keystroke monitoring",
    ],
  },
  vague_brief: {
    basePatience: 75,
    baseTrust: 65,
    baseBudget: 4000,
    hiddenAsks: [
      "Reject completed mockups saying 'it does not match the vibe I envisioned'",
      "Completely pivot core user flow after the prototype is signed off",
      "Demand simultaneous emulation of 4 completely contradictory competitor products",
    ],
  },
};

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await SimulationRepository.listSessionsByUser(user.userId);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSimulationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { persona, difficulty, briefId, chatLogId, includeMeetingIds } = parsed.data;
  const cfg = PERSONA_CONFIGS[persona] || PERSONA_CONFIGS.scope_creeper;

  const difficultyMultiplier = difficulty === 3 ? 1.4 : difficulty === 2 ? 1.0 : 0.7;
  const patience = Math.max(20, Math.round(cfg.basePatience - difficulty * 10));
  const trust = Math.max(20, Math.round(cfg.baseTrust - difficulty * 8));
  const budgetCeiling = Math.round(cfg.baseBudget / difficultyMultiplier);

  const session = await SimulationRepository.createSession({
    userId: user.userId,
    persona,
    difficulty,
    patience,
    trust,
    budgetCeiling,
    hiddenAsks: cfg.hiddenAsks,
    briefId,
    chatLogId,
    meetingIds: includeMeetingIds,
  });

  // Create initial opener turn from the Bad Client
  let opener = "Hey, thanks for jumping on. I looked over what we talked about, but honestly there are several things we need to nail down right away before we can agree on scope or price.";
  if (persona === "scope_creeper") {
    opener = "Hey there! Really excited to work together. I was reviewing our project notes and I have a few quick 'must-have' additions we should include in the baseline scope.";
  } else if (persona === "budget_haggler") {
    opener = "Hello. We like your portfolio, but your initial quote is way higher than what we budgeted. Other freelancers quoted us half that. What can you do on the price?";
  } else if (persona === "micromanager") {
    opener = "Morning. Before we proceed, I need to know your exact day-to-day workflow. How often will you push updates, and can we schedule daily check-ins?";
  } else if (persona === "ghost_payer") {
    opener = "Hi. Our corporate policy prohibits paying any upfront deposits until we see working code on our own servers. That shouldn't be an issue, right?";
  } else if (persona === "vague_brief") {
    opener = "Hey! So I know we sent over some notes, but to be honest I feel like the current direction doesn't pop enough. We want something disruptive and revolutionary.";
  }

  await SimulationRepository.addTurn({
    sessionId: session.id,
    role: "client",
    content: opener,
    turnIndex: 0,
  });

  return NextResponse.json({
    session: {
      id: session.id,
      persona: session.persona,
      difficulty: session.difficulty,
      status: session.status,
      initialMessage: opener,
    },
  }, { status: 201 });
}
