const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  async create({ fromUserId, toUserId, projectId, score, comment }) {
    return prisma.rating.create({
      data: { fromUserId, toUserId, projectId, score, comment }
    });
  },

  async getUserAverageScore(userId) {
    const agg = await prisma.rating.aggregate({
      where: { toUserId: userId },
      _avg: { score: true },
      _count: { _all: true }
    });
    return { average: agg._avg.score || 0, count: agg._count._all || 0 };
  },

  async hasUserRatedProject({ fromUserId, projectId }) {
    const existing = await prisma.rating.findUnique({
      where: { projectId_fromUserId: { projectId, fromUserId } }
    });
    return Boolean(existing);
  },
};
