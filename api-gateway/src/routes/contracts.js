const express = require('express');
const { body, param, query } = require('express-validator');
const Contract = require('../models/Contract');
const Job = require('../models/Job');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');
const logger = require('../utils/logger');
const { blockchainService } = require('../services/blockchain');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Contract:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         job:
 *           type: string
 *         client:
 *           type: string
 *         freelancer:
 *           type: string
 *         amount:
 *           type: string
 *           description: Contract amount in SKILL tokens
 *         status:
 *           type: string
 *           enum: [created, funded, in-progress, completed, disputed, cancelled]
 *         contractAddress:
 *           type: string
 *           description: Blockchain contract address
 *         milestones:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               amount:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [pending, completed, approved]
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Get user's contracts
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, funded, in-progress, completed, disputed, cancelled]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, freelancer]
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
 *         description: Contracts retrieved successfully
 */
router.get('/',
  auth.authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['created', 'funded', 'in-progress', 'completed', 'disputed', 'cancelled']),
    query('role').optional().isIn(['client', 'freelancer'])
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { status, role, page = 1, limit = 20 } = req.query;

      // Build query based on user role
      let query = {};
      if (role === 'client') {
        query.client = req.user.id;
      } else if (role === 'freelancer') {
        query.freelancer = req.user.id;
      } else {
        query.$or = [
          { client: req.user.id },
          { freelancer: req.user.id }
        ];
      }

      if (status) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [contracts, total] = await Promise.all([
        Contract.find(query)
          .populate('job', 'title description budget')
          .populate('client', 'firstName lastName username avatar')
          .populate('freelancer', 'firstName lastName username avatar')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Contract.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: contracts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  }
);

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Create a new contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - freelancerId
 *               - amount
 *             properties:
 *               jobId:
 *                 type: string
 *               freelancerId:
 *                 type: string
 *               amount:
 *                 type: string
 *                 description: Contract amount in SKILL tokens
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     deadline:
 *                       type: string
 *                       format: date
 *                     description:
 *                       type: string
 *     responses:
 *       201:
 *         description: Contract created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 */
router.post('/',
  auth.authenticate,
  [
    body('jobId').isMongoId().withMessage('Valid job ID is required'),
    body('freelancerId').isMongoId().withMessage('Valid freelancer ID is required'),
    body('amount').isNumeric().custom(value => {
      if (parseFloat(value) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      return true;
    }),
    body('milestones').optional().isArray({ max: 10 }),
    body('milestones.*.title').optional().trim().isLength({ min: 1, max: 100 }),
    body('milestones.*.amount').optional().isNumeric(),
    body('milestones.*.deadline').optional().isISO8601()
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { jobId, freelancerId, amount, milestones = [] } = req.body;

      // Verify job exists and user is the client
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to create contract for this job' });
      }

      if (job.status !== 'open') {
        return res.status(400).json({ error: 'Job is not open for contracts' });
      }

      // Verify freelancer exists
      const freelancer = await User.findById(freelancerId);
      if (!freelancer) {
        return res.status(404).json({ error: 'Freelancer not found' });
      }

      // Validate milestone amounts sum to total amount
      if (milestones.length > 0) {
        const milestoneTotal = milestones.reduce((sum, m) => sum + parseFloat(m.amount), 0);
        if (Math.abs(milestoneTotal - parseFloat(amount)) > 0.01) {
          return res.status(400).json({ 
            error: 'Milestone amounts must sum to total contract amount' 
          });
        }
      }

      // Create contract on blockchain
      const blockchainResult = await blockchainService.createEscrowContract({
        client: req.user.walletAddress,
        freelancer: freelancer.walletAddress,
        amount,
        milestones: milestones.map(m => ({
          ...m,
          amount: m.amount,
          deadline: new Date(m.deadline).getTime() / 1000
        }))
      });

      if (!blockchainResult.success) {
        return res.status(500).json({ 
          error: 'Failed to create blockchain contract',
          details: blockchainResult.error
        });
      }

      // Create contract in database
      const contract = new Contract({
        job: jobId,
        client: req.user.id,
        freelancer: freelancerId,
        amount,
        status: 'created',
        contractAddress: blockchainResult.contractAddress,
        transactionHash: blockchainResult.transactionHash,
        milestones: milestones.map(m => ({
          ...m,
          status: 'pending'
        }))
      });

      await contract.save();

      // Update job status
      job.status = 'in-progress';
      job.selectedFreelancer = freelancerId;
      await job.save();

      // Populate contract data
      await contract.populate([
        { path: 'job', select: 'title description' },
        { path: 'client', select: 'firstName lastName username avatar' },
        { path: 'freelancer', select: 'firstName lastName username avatar' }
      ]);

      // Emit real-time updates
      req.io.to(`user:${req.user.id}`).emit('contract-created', contract);
      req.io.to(`user:${freelancerId}`).emit('contract-created', contract);

      logger.info('Contract created successfully', {
        contractId: contract._id,
        jobId,
        clientId: req.user.id,
        freelancerId,
        amount
      });

      res.status(201).json({
        success: true,
        message: 'Contract created successfully',
        data: contract
      });

    } catch (error) {
      logger.error('Error creating contract:', error);
      res.status(500).json({ error: 'Failed to create contract' });
    }
  }
);

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Get contract by ID
 *     tags: [Contracts]
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
 *         description: Contract retrieved successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Contract not found
 */
router.get('/:id',
  auth.authenticate,
  [param('id').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const contract = await Contract.findById(req.params.id)
        .populate('job', 'title description budget skills')
        .populate('client', 'firstName lastName username avatar reputation')
        .populate('freelancer', 'firstName lastName username avatar reputation');

      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Check if user is involved in the contract
      const isAuthorized = contract.client._id.toString() === req.user.id || 
                          contract.freelancer._id.toString() === req.user.id;

      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to view this contract' });
      }

      // Get blockchain contract status
      try {
        const blockchainStatus = await blockchainService.getContractStatus(contract.contractAddress);
        contract.blockchainStatus = blockchainStatus;
      } catch (blockchainError) {
        logger.error('Error fetching blockchain status:', blockchainError);
        // Continue without blockchain status
      }

      res.json({
        success: true,
        data: contract
      });
    } catch (error) {
      logger.error('Error fetching contract:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  }
);

/**
 * @swagger
 * /api/contracts/{id}/fund:
 *   post:
 *     summary: Fund the contract (client only)
 *     tags: [Contracts]
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
 *             required:
 *               - transactionHash
 *             properties:
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *     responses:
 *       200:
 *         description: Contract funded successfully
 *       400:
 *         description: Invalid transaction or contract already funded
 *       403:
 *         description: Not authorized
 */
router.post('/:id/fund',
  auth.authenticate,
  [
    param('id').isMongoId(),
    body('transactionHash').matches(/^0x[a-fA-F0-9]{64}$/)
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { transactionHash } = req.body;

      const contract = await Contract.findById(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      if (contract.client.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Only the client can fund the contract' });
      }

      if (contract.status !== 'created') {
        return res.status(400).json({ error: 'Contract cannot be funded in current status' });
      }

      // Verify funding transaction on blockchain
      const verification = await blockchainService.verifyFundingTransaction(
        transactionHash,
        contract.contractAddress,
        contract.amount
      );

      if (!verification.success) {
        return res.status(400).json({ 
          error: 'Invalid funding transaction',
          details: verification.error
        });
      }

      // Update contract status
      contract.status = 'funded';
      contract.fundingTransactionHash = transactionHash;
      contract.fundedAt = new Date();
      await contract.save();

      // Emit real-time updates
      req.io.to(`user:${contract.client}`).emit('contract-funded', contract);
      req.io.to(`user:${contract.freelancer}`).emit('contract-funded', contract);

      logger.info('Contract funded successfully', {
        contractId: contract._id,
        transactionHash,
        amount: contract.amount
      });

      res.json({
        success: true,
        message: 'Contract funded successfully',
        data: contract
      });

    } catch (error) {
      logger.error('Error funding contract:', error);
      res.status(500).json({ error: 'Failed to fund contract' });
    }
  }
);

/**
 * @swagger
 * /api/contracts/{id}/complete-milestone:
 *   post:
 *     summary: Mark milestone as completed (freelancer) or approve milestone (client)
 *     tags: [Contracts]
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
 *             required:
 *               - milestoneIndex
 *               - action
 *             properties:
 *               milestoneIndex:
 *                 type: integer
 *               action:
 *                 type: string
 *                 enum: [complete, approve]
 *               transactionHash:
 *                 type: string
 *                 description: Required for approve action
 *     responses:
 *       200:
 *         description: Milestone updated successfully
 */
router.post('/:id/complete-milestone',
  auth.authenticate,
  [
    param('id').isMongoId(),
    body('milestoneIndex').isInt({ min: 0 }),
    body('action').isIn(['complete', 'approve']),
    body('transactionHash').optional().matches(/^0x[a-fA-F0-9]{64}$/)
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { milestoneIndex, action, transactionHash } = req.body;

      const contract = await Contract.findById(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      if (milestoneIndex >= contract.milestones.length) {
        return res.status(400).json({ error: 'Invalid milestone index' });
      }

      const milestone = contract.milestones[milestoneIndex];

      if (action === 'complete') {
        // Freelancer marking milestone as completed
        if (contract.freelancer.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Only the freelancer can complete milestones' });
        }

        if (milestone.status !== 'pending') {
          return res.status(400).json({ error: 'Milestone is not pending' });
        }

        milestone.status = 'completed';
        milestone.completedAt = new Date();

      } else if (action === 'approve') {
        // Client approving milestone and releasing payment
        if (contract.client.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Only the client can approve milestones' });
        }

        if (milestone.status !== 'completed') {
          return res.status(400).json({ error: 'Milestone must be completed before approval' });
        }

        if (!transactionHash) {
          return res.status(400).json({ error: 'Transaction hash required for milestone approval' });
        }

        // Verify payment release transaction
        const verification = await blockchainService.verifyMilestonePayment(
          transactionHash,
          contract.contractAddress,
          milestoneIndex,
          milestone.amount
        );

        if (!verification.success) {
          return res.status(400).json({ 
            error: 'Invalid payment transaction',
            details: verification.error
          });
        }

        milestone.status = 'approved';
        milestone.approvedAt = new Date();
        milestone.paymentTransactionHash = transactionHash;
      }

      await contract.save();

      // Check if all milestones are approved
      const allApproved = contract.milestones.every(m => m.status === 'approved');
      if (allApproved && contract.status === 'funded') {
        contract.status = 'completed';
        contract.completedAt = new Date();
        await contract.save();
      }

      // Emit real-time updates
      req.io.to(`user:${contract.client}`).emit('milestone-updated', { contract, milestoneIndex });
      req.io.to(`user:${contract.freelancer}`).emit('milestone-updated', { contract, milestoneIndex });

      res.json({
        success: true,
        message: `Milestone ${action}d successfully`,
        data: contract
      });

    } catch (error) {
      logger.error('Error updating milestone:', error);
      res.status(500).json({ error: 'Failed to update milestone' });
    }
  }
);

/**
 * @swagger
 * /api/contracts/{id}/dispute:
 *   post:
 *     summary: Raise a dispute for the contract
 *     tags: [Contracts]
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
 *             required:
 *               - reason
 *               - description
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [non-delivery, poor-quality, payment-issue, scope-change, other]
 *               description:
 *                 type: string
 *                 minLength: 20
 *                 maxLength: 1000
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs to evidence files
 *     responses:
 *       200:
 *         description: Dispute raised successfully
 *       400:
 *         description: Contract cannot be disputed
 */
router.post('/:id/dispute',
  auth.authenticate,
  [
    param('id').isMongoId(),
    body('reason').isIn(['non-delivery', 'poor-quality', 'payment-issue', 'scope-change', 'other']),
    body('description').trim().isLength({ min: 20, max: 1000 }),
    body('evidence').optional().isArray({ max: 10 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { reason, description, evidence = [] } = req.body;

      const contract = await Contract.findById(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Check if user is involved in the contract
      const isAuthorized = contract.client.toString() === req.user.id || 
                          contract.freelancer.toString() === req.user.id;

      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to dispute this contract' });
      }

      if (!['funded', 'in-progress'].includes(contract.status)) {
        return res.status(400).json({ error: 'Contract cannot be disputed in current status' });
      }

      // Create dispute on blockchain (DAO)
      const disputeResult = await blockchainService.createDispute({
        contractAddress: contract.contractAddress,
        initiator: req.user.walletAddress,
        reason,
        description,
        evidence
      });

      if (!disputeResult.success) {
        return res.status(500).json({ 
          error: 'Failed to create blockchain dispute',
          details: disputeResult.error
        });
      }

      // Update contract status
      contract.status = 'disputed';
      contract.dispute = {
        initiator: req.user.id,
        reason,
        description,
        evidence,
        createdAt: new Date(),
        blockchainDisputeId: disputeResult.disputeId
      };
      await contract.save();

      // Emit real-time updates
      req.io.to(`user:${contract.client}`).emit('contract-disputed', contract);
      req.io.to(`user:${contract.freelancer}`).emit('contract-disputed', contract);

      logger.info('Contract dispute raised', {
        contractId: contract._id,
        initiator: req.user.id,
        reason
      });

      res.json({
        success: true,
        message: 'Dispute raised successfully. The DAO will review your case.',
        data: contract
      });

    } catch (error) {
      logger.error('Error raising dispute:', error);
      res.status(500).json({ error: 'Failed to raise dispute' });
    }
  }
);

module.exports = router;