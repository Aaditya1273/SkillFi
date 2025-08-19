const express = require('express');
const { body, param, query } = require('express-validator');
const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');
const logger = require('../utils/logger');
const { matchingService } = require('../services/matching');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Job:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - budget
 *         - category
 *         - skills
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *           maxLength: 100
 *         description:
 *           type: string
 *           maxLength: 5000
 *         category:
 *           type: string
 *           enum: [web-development, mobile-development, blockchain, ai-ml, data-science, design, marketing, writing, consulting, other]
 *         budget:
 *           type: number
 *           minimum: 1
 *         budgetType:
 *           type: string
 *           enum: [fixed, hourly, milestone-based]
 *         skills:
 *           type: array
 *           items:
 *             type: string
 *         experienceLevel:
 *           type: string
 *           enum: [entry, junior, mid, senior, expert, any]
 *         timeline:
 *           type: string
 *         status:
 *           type: string
 *           enum: [draft, open, in-progress, completed, cancelled]
 *         client:
 *           $ref: '#/components/schemas/User'
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all jobs with filtering and pagination
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: Comma-separated skills
 *       - in: query
 *         name: budgetMin
 *         schema:
 *           type: number
 *       - in: query
 *         name: budgetMax
 *         schema:
 *           type: number
 *       - in: query
 *         name: experienceLevel
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('budgetMin').optional().isFloat({ min: 0 }),
    query('budgetMax').optional().isFloat({ min: 0 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        skills,
        budgetMin,
        budgetMax,
        experienceLevel,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query = { 
        status: 'open',
        visibility: 'public'
      };

      if (category) {
        query.category = category;
      }

      if (skills) {
        const skillArray = skills.split(',').map(s => s.trim());
        query.skills = { $in: skillArray };
      }

      if (budgetMin || budgetMax) {
        query.budget = {};
        if (budgetMin) query.budget.$gte = parseFloat(budgetMin);
        if (budgetMax) query.budget.$lte = parseFloat(budgetMax);
      }

      if (experienceLevel && experienceLevel !== 'any') {
        query.experienceLevel = { $in: [experienceLevel, 'any'] };
      }

      if (search) {
        query.$text = { $search: search };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [jobs, total] = await Promise.all([
        Job.find(query)
          .populate('client', 'firstName lastName avatar reputation company')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Job.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job posting
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - budget
 *               - budgetType
 *               - category
 *               - skills
 *               - timeline
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               budget:
 *                 type: number
 *                 minimum: 1
 *               budgetType:
 *                 type: string
 *                 enum: [fixed, hourly, milestone-based]
 *               category:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               timeline:
 *                 type: string
 *               experienceLevel:
 *                 type: string
 *                 enum: [entry, junior, mid, senior, expert, any]
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     budget:
 *                       type: number
 *                     deadline:
 *                       type: string
 *                       format: date
 *     responses:
 *       201:
 *         description: Job created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/',
  auth.authenticate,
  [
    body('title').trim().isLength({ min: 5, max: 100 }),
    body('description').trim().isLength({ min: 50, max: 5000 }),
    body('budget').isFloat({ min: 1 }),
    body('budgetType').isIn(['fixed', 'hourly', 'milestone-based']),
    body('category').isIn(['web-development', 'mobile-development', 'blockchain', 'ai-ml', 'data-science', 'design', 'marketing', 'writing', 'consulting', 'other']),
    body('skills').isArray({ min: 1, max: 10 }),
    body('timeline').trim().isLength({ min: 1, max: 100 }),
    body('experienceLevel').optional().isIn(['entry', 'junior', 'mid', 'senior', 'expert', 'any']),
    body('milestones').optional().isArray({ max: 10 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const jobData = {
        ...req.body,
        client: req.user.id,
        status: 'draft'
      };

      const job = new Job(jobData);
      await job.save();

      // Populate client data
      await job.populate('client', 'firstName lastName avatar reputation company');

      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job
      });
    } catch (error) {
      logger.error('Error creating job:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  }
);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job retrieved successfully
 *       404:
 *         description: Job not found
 */
router.get('/:id',
  [param('id').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id)
        .populate('client', 'firstName lastName avatar reputation company')
        .populate('selectedFreelancer', 'firstName lastName avatar reputation');

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Increment view count
      if (req.user && req.user.id !== job.client._id.toString()) {
        await job.incrementViews(req.user.id);
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      logger.error('Error fetching job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  }
);

/**
 * @swagger
 * /api/jobs/{id}:
 *   put:
 *     summary: Update job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [draft, open, in-progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Job updated successfully
 *       403:
 *         description: Not authorized to update this job
 *       404:
 *         description: Job not found
 */
router.put('/:id',
  auth.authenticate,
  [
    param('id').isMongoId(),
    body('title').optional().trim().isLength({ min: 5, max: 100 }),
    body('description').optional().trim().isLength({ min: 50, max: 5000 }),
    body('budget').optional().isFloat({ min: 1 }),
    body('skills').optional().isArray({ min: 1, max: 10 }),
    body('status').optional().isIn(['draft', 'open', 'in-progress', 'completed', 'cancelled'])
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to update this job' });
      }

      // Prevent certain updates based on status
      if (job.status === 'in-progress' && req.body.status === 'open') {
        return res.status(400).json({ error: 'Cannot reopen job that is in progress' });
      }

      const updatedJob = await Job.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).populate('client', 'firstName lastName avatar reputation company');

      // Emit real-time update
      req.io.to(`job:${req.params.id}`).emit('job-updated', updatedJob);

      res.json({
        success: true,
        message: 'Job updated successfully',
        data: updatedJob
      });
    } catch (error) {
      logger.error('Error updating job:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  }
);

/**
 * @swagger
 * /api/jobs/{id}/publish:
 *   post:
 *     summary: Publish a draft job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job published successfully
 *       400:
 *         description: Job cannot be published
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Job not found
 */
router.post('/:id/publish',
  auth.authenticate,
  [param('id').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to publish this job' });
      }

      if (job.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft jobs can be published' });
      }

      job.status = 'open';
      job.postedAt = new Date();
      await job.save();

      // Trigger AI matching for this job
      try {
        await matchingService.findMatchesForJob(job._id);
      } catch (matchingError) {
        logger.error('Error triggering AI matching:', matchingError);
        // Don't fail the publish operation if matching fails
      }

      res.json({
        success: true,
        message: 'Job published successfully',
        data: job
      });
    } catch (error) {
      logger.error('Error publishing job:', error);
      res.status(500).json({ error: 'Failed to publish job' });
    }
  }
);

/**
 * @swagger
 * /api/jobs/{id}/proposals:
 *   get:
 *     summary: Get proposals for a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proposals retrieved successfully
 *       403:
 *         description: Not authorized to view proposals
 *       404:
 *         description: Job not found
 */
router.get('/:id/proposals',
  auth.authenticate,
  [param('id').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to view proposals for this job' });
      }

      const proposals = await Proposal.find({ job: req.params.id })
        .populate('freelancer', 'firstName lastName avatar reputation hourlyRate')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: proposals
      });
    } catch (error) {
      logger.error('Error fetching job proposals:', error);
      res.status(500).json({ error: 'Failed to fetch proposals' });
    }
  }
);

/**
 * @swagger
 * /api/jobs/{id}/matches:
 *   get:
 *     summary: Get AI-generated matches for a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           default: 0.3
 *     responses:
 *       200:
 *         description: Matches retrieved successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Job not found
 */
router.get('/:id/matches',
  auth.authenticate,
  [
    param('id').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('minScore').optional().isFloat({ min: 0, max: 1 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to view matches for this job' });
      }

      const { limit = 20, minScore = 0.3 } = req.query;

      const matches = await matchingService.findMatchesForJob(req.params.id, {
        limit: parseInt(limit),
        minScore: parseFloat(minScore)
      });

      res.json({
        success: true,
        data: matches
      });
    } catch (error) {
      logger.error('Error fetching job matches:', error);
      res.status(500).json({ error: 'Failed to fetch matches' });
    }
  }
);

/**
 * @swagger
 * /api/jobs/my-jobs:
 *   get:
 *     summary: Get current user's jobs
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User's jobs retrieved successfully
 */
router.get('/my-jobs',
  auth.authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const query = { client: req.user.id };
      if (status) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [jobs, total] = await Promise.all([
        Job.find(query)
          .populate('selectedFreelancer', 'firstName lastName avatar reputation')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Job.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching user jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

module.exports = router;