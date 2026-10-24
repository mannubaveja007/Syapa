import { prisma } from "../client";

export class UserRepository {
  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async createUser(data: { name?: string; email: string; passwordHash?: string }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
      },
    });
  }
}
