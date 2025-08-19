const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  async upsert(userId, data) {
    return prisma.userReputation.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  async get(userId) {
    return prisma.userReputation.findUnique({ where: { userId } });
  },
};
