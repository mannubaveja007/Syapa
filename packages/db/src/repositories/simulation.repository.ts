import { prisma } from "../client.js";

export interface CreateSimulationParams {
  userId: string;
  persona: string;
  difficulty: number;
  patience: number;
  trust: number;
  budgetCeiling: number;
  hiddenAsks: string[];
  briefId?: string;
  chatLogId?: string;
  meetingIds?: string[];
}

export interface AddTurnParams {
  sessionId: string;
  role: "user" | "client";
  content: string;
  turnIndex: number;
  hiddenStateDelta?: any;
  rawResponse?: any;
}

export interface SaveScorecardParams {
  sessionId: string;
  userId: string;
  overallScore: number;
  summary: string;
  freeConcessions: any[];
  boundariesHeld: any[];
  priceAnchoring: any;
  vaguePromises: any[];
  rewrites: any[];
}

export class SimulationRepository {
  static async createSession(params: CreateSimulationParams) {
    return prisma.simulationSession.create({
      data: {
        userId: params.userId,
        persona: params.persona,
        difficulty: params.difficulty,
        patience: params.patience,
        trust: params.trust,
        budgetCeiling: params.budgetCeiling,
        hiddenAsks: params.hiddenAsks,
        briefId: params.briefId,
        chatLogId: params.chatLogId,
        meetingIds: params.meetingIds || [],
      },
    });
  }

  static async getSession(id: string, userId?: string) {
    return prisma.simulationSession.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
      include: {
        turns: {
          orderBy: { turnIndex: "asc" },
        },
        scorecard: true,
      },
    });
  }

  static async listSessionsByUser(userId: string) {
    return prisma.simulationSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        scorecard: {
          select: { overallScore: true, createdAt: true },
        },
        _count: {
          select: { turns: true },
        },
      },
    });
  }

  static async addTurn(params: AddTurnParams) {
    return prisma.simulationTurn.create({
      data: {
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        turnIndex: params.turnIndex,
        hiddenStateDelta: params.hiddenStateDelta,
        rawResponse: params.rawResponse,
      },
    });
  }

  static async updateHiddenState(sessionId: string, patience: number, trust: number, hiddenAsks?: string[]) {
    return prisma.simulationSession.update({
      where: { id: sessionId },
      data: {
        patience: Math.max(0, Math.min(100, patience)),
        trust: Math.max(0, Math.min(100, trust)),
        ...(hiddenAsks ? { hiddenAsks } : {}),
      },
    });
  }

  static async completeSession(sessionId: string) {
    return prisma.simulationSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED" },
    });
  }

  static async saveScorecard(params: SaveScorecardParams) {
    return prisma.scorecard.create({
      data: {
        sessionId: params.sessionId,
        userId: params.userId,
        overallScore: params.overallScore,
        summary: params.summary,
        freeConcessions: params.freeConcessions,
        boundariesHeld: params.boundariesHeld,
        priceAnchoring: params.priceAnchoring,
        vaguePromises: params.vaguePromises,
        rewrites: params.rewrites,
      },
    });
  }

  static async getScorecardBySessionId(sessionId: string, userId?: string) {
    return prisma.scorecard.findFirst({
      where: {
        sessionId,
        ...(userId ? { userId } : {}),
      },
      include: {
        session: {
          include: {
            turns: { orderBy: { turnIndex: "asc" } },
          },
        },
      },
    });
  }
}
