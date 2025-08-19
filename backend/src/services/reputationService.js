const ratingRepo = require('../repositories/ratingRepository');
const repEventRepo = require('../repositories/reputationEventRepository');
const userRepRepo = require('../repositories/userReputationRepository');
const calculator = require('./reputationCalculator');
const fraud = require('./fraudRiskEngine');

module.exports = {
  // Recompute and persist user's reputation
  async recomputeUser(userId, options = {}) {
    const { average, count } = await ratingRepo.getUserAverageScore(userId);

    // Fetch recent events (limit for performance)
    const events = await repEventRepo.listByUser(userId, { limit: 200 });

    // Placeholder: obtain on-chain base and fraud signals from other services
    const onChainBase = options.onChainBase ?? 50; // to be wired to escrow/DAO later

    const fraudPenalty = fraud.evaluate(options.fraudSignals || {});

    const result = calculator.compute({
      ratingAverage: average,
      ratingCount: count,
      onChainBase,
      events,
      fraudPenalty,
      weights: options.weights,
      decay: options.decay,
    });

    await userRepRepo.upsert(userId, {
      score: result.score,
      onChainScore: result.components.onChainScore,
      ratingScore: result.components.ratingScore,
      fraudPenalty: result.components.fraudPenalty,
    });

    return {
      userId,
      score: result.score,
      components: result.components,
      updatedAt: new Date().toISOString(),
    };
  }
};
