const express = require('express');
const auth = require('../middleware/auth');
const userRepRepo = require('../repositories/userReputationRepository');
const repEventRepo = require('../repositories/reputationEventRepository');
const reputationService = require('../services/reputationService');

const router = express.Router();

// Get a user's reputation snapshot and recent events
router.get('/users/:id/reputation', async (req, res) => {
  try {
    const userId = req.params.id;
    const rep = await userRepRepo.get(userId);
    const events = await repEventRepo.listByUser(userId, { limit: 50 });

    if (!rep) {
      // If no record yet, compute a default one on the fly
      const computed = await reputationService.recomputeUser(userId);
      return res.json({ reputation: computed, events });
    }

    res.json({ reputation: { userId, score: rep.score, components: {
      ratingScore: rep.ratingScore,
      onChainScore: rep.onChainScore,
      fraudPenalty: rep.fraudPenalty,
    }, updatedAt: rep.lastUpdatedAt }, events });
  } catch (err) {
    console.error('Get reputation error:', err);
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
});

// Recompute a user's reputation manually (auth required)
router.post('/reputation/recompute/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { weights, decay, onChainBase, fraudSignals } = req.body || {};
    const result = await reputationService.recomputeUser(userId, { weights, decay, onChainBase, fraudSignals });
    res.json(result);
  } catch (err) {
    console.error('Recompute reputation error:', err);
    res.status(500).json({ error: 'Failed to recompute reputation' });
  }
});

module.exports = router;
