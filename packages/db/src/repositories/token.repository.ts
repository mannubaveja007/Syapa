import { randomBytes } from "node:crypto";
import { prisma } from "../client.js";

export class ApiTokenRepository {
  static async createToken(userId: string, name = "Chrome Extension", expiresInDays = 30) {
    const token = `syp_${randomBytes(24).toString("hex")}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const apiToken = await prisma.apiToken.create({
      data: {
        userId,
        name,
        token,
        expiresAt,
      },
    });

    return apiToken;
  }

  static async validateToken(token: string) {
    const apiToken = await prisma.apiToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!apiToken) return null;
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) return null;

    // Update lastUsedAt asynchronously
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    });

    return apiToken;
  }

  static async listByUser(userId: string) {
    return prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async revokeToken(id: string, userId: string) {
    return prisma.apiToken.deleteMany({
      where: { id, userId },
    });
  }
}
