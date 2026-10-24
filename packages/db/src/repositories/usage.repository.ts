import { prisma } from "../client";

export interface LogAiUsageInput {
  model: string;
  provider: string;
  callType: "MEETING_ANALYSIS" | "SIMULATION_TURN" | "SCORECARD" | "EMBEDDINGS" | string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
  latencyMs?: number;
  metadata?: Record<string, any>;
}

export class AiUsageRepository {
  static async logUsage(input: LogAiUsageInput) {
    try {
      return await prisma.aiUsage.create({
        data: {
          model: input.model,
          provider: input.provider,
          callType: input.callType,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens: input.totalTokens,
          cost: input.cost ?? 0,
          latencyMs: input.latencyMs ?? 0,
          metadata: input.metadata || {},
        },
      });
    } catch (err) {
      console.warn("[AiUsageRepository] Failed to log usage to database:", err);
      return null;
    }
  }

  static async getRecentUsage(limit = 100) {
    return prisma.aiUsage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async getAggregates() {
    const totalCalls = await prisma.aiUsage.count();
    const tokenAggregates = await prisma.aiUsage.aggregate({
      _sum: {
        totalTokens: true,
        cost: true,
      },
    });
    return {
      totalCalls,
      totalTokens: tokenAggregates._sum.totalTokens || 0,
      totalCost: tokenAggregates._sum.cost || 0,
    };
  }
}
