// Simple rule-based fraud risk engine. Returns a non-negative integer penalty.
// Inputs are passed in; integration can evolve to query more context.
module.exports = {
  evaluate({
    recentDisputes = 0,
    disputesLost = 0,
    ratingsBurst = 0, // many ratings in short time
    duplicateClients = 0, // repeated mutual ratings between same pairs
    lowEffortSignals = 0, // flagged by heuristics
  } = {}) {
    let penalty = 0;

    // Dispute-related penalties
    penalty += Math.min(recentDisputes * 2, 20);
    penalty += Math.min(disputesLost * 5, 30);

    // Abuse patterns
    penalty += Math.min(ratingsBurst * 2, 20);
    penalty += Math.min(duplicateClients * 3, 20);

    // Other heuristics
    penalty += Math.min(lowEffortSignals * 2, 10);

    return Math.max(0, Math.floor(penalty));
  },
};
