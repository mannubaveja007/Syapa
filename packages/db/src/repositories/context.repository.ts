import { prisma } from "../client";

export interface CreateContextParams {
  userId: string;
  title: string;
  type: "BRIEF" | "CHAT";
  content: string;
  metadata?: Record<string, any>;
}

export class ProjectContextRepository {
  static async createContext(params: CreateContextParams) {
    return prisma.projectContext.create({
      data: {
        userId: params.userId,
        title: params.title,
        type: params.type,
        content: params.content,
        metadata: params.metadata || {},
      },
    });
  }

  static async getById(id: string, userId?: string) {
    return prisma.projectContext.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
    });
  }

  static async listByUser(userId: string, type?: "BRIEF" | "CHAT") {
    return prisma.projectContext.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async deleteContext(id: string, userId: string) {
    return prisma.projectContext.deleteMany({
      where: { id, userId },
    });
  }
}
