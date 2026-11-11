import { prisma } from '../../database/prisma';
import { UpsertAuthUserInput } from './auth.types';

export class AuthRepository {
  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async upsertUser(data: UpsertAuthUserInput) {
    return prisma.user.upsert({
      where: { id: data.id },
      update: {
        email: data.email,
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
      create: {
        id: data.id,
        email: data.email,
        name: data.name ?? (data.email ? data.email.split('@')[0] : null),
      },
    });
  }

  async updateUserName(id: string, name: string) {
    return prisma.user.update({
      where: { id },
      data: { name },
    });
  }
}
