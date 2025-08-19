const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const ratingRepo = require('../repositories/ratingRepository');
const repEventRepo = require('../repositories/reputationEventRepository');
const reputationService = require('../services/reputationService');

const router = express.Router();

// Create a rating from client -> freelancer after project completion
router.post(
  '/',
  auth,
  [
    body('toUserId').isString().notEmpty(),
    body('projectId').isString().notEmpty(),
    body('score').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const fromUserId = req.user.id;
      const { toUserId, projectId, score, comment } = req.body;

      // Enforce one rating per project per rater
      const already = await ratingRepo.hasUserRatedProject({ fromUserId, projectId });
      if (already) return res.status(409).json({ error: 'You have already rated this project.' });

      const created = await ratingRepo.create({ fromUserId, toUserId, projectId, score, comment });

      // Add a reputation event for receiver
      await repEventRepo.addEvent({
        userId: toUserId,
        type: 'CLIENT_RATING',
        weight: score, // simple weighting by score
        delta: (score - 3) * 10, // map 1..5 roughly to -20..+20
        metadata: { fromUserId, projectId, score },
      });

      // Recompute reputation for receiver
      const result = await reputationService.recomputeUser(toUserId);

      res.status(201).json({ rating: created, reputation: result });
    } catch (err) {
      console.error('Create rating error:', err);
      res.status(500).json({ error: 'Failed to create rating' });
    }
  }
);

module.exports = router;
