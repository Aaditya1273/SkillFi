// Combines multiple signals into a 0-100 score with optional time decay.
// events: [{ type, weight, delta, createdAt }]

function timeDecayFactor(createdAt, { halfLifeDays = 90 } = {}) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
  if (halfLifeMs <= 0) return 1;
  // Exponential decay: factor = 0.5^(age/halfLife)
  return Math.pow(0.5, ageMs / halfLifeMs);
}

module.exports = {
  compute({
    base = 50,
    ratingAverage = 0, // 1..5
    ratingCount = 0,
    onChainBase = 0,
    events = [],
    fraudPenalty = 0,
    weights = {
      ratingWeight: 0.5,
      onChainWeight: 0.3,
      eventsWeight: 0.2,
    },
    decay = { halfLifeDays: 90 },
  }) {
    const { ratingWeight, onChainWeight, eventsWeight } = weights;

    // Normalize ratings to 0..100 with Bayesian average to avoid low-sample bias
    const prior = 3.5; // neutral prior
    const priorWeight = 5;
    const bayesian = (ratingAverage * ratingCount + prior * priorWeight) / (ratingCount + priorWeight);
    const ratingScore = Math.max(0, Math.min(100, (bayesian - 1) * 25)); // 1..5 -> 0..100

    const onChainScore = Math.max(0, Math.min(100, onChainBase));

    // Event contributions with time decay
    let eventScoreRaw = 0;
    for (const e of events) {
      const factor = timeDecayFactor(e.createdAt, decay);
      eventScoreRaw += (e.delta ?? 0) * (e.weight ?? 1) * factor;
    }
    const eventScore = Math.max(0, Math.min(100, eventScoreRaw + 50)); // center around 50

    let composite = base
      + ratingWeight * (ratingScore - 50)
      + onChainWeight * (onChainScore - 50)
      + eventsWeight * (eventScore - 50);

    composite = Math.max(0, Math.min(100, Math.round(composite - fraudPenalty)));

    return {
      score: composite,
      components: {
        ratingScore: Math.round(ratingScore),
        onChainScore: Math.round(onChainScore),
        eventsScore: Math.round(eventScore),
        fraudPenalty: Math.round(fraudPenalty),
      }
    };
  }
};
