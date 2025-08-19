const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  async addEvent({ userId, type, weight = 0, delta = 0, metadata = null }) {
    return prisma.reputationEvent.create({
      data: { userId, type, weight, delta, metadata }
    });
  },

  async listByUser(userId, { limit = 100, cursor = null } = {}) {
    return prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });
  },
};
