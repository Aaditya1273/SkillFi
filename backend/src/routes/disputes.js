const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { analyzeDispute } = require('../services/disputeResolverService');

const router = express.Router();

// Analyze a dispute for a project
router.post('/analyze',
  auth,
  [ body('projectId').isString().withMessage('projectId is required') ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { projectId } = req.body;
      const result = await analyzeDispute(projectId);

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[Disputes] analyze error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to analyze dispute' });
    }
  }
);

module.exports = router;
