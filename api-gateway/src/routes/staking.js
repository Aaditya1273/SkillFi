const express = require('express');
const { body, param, query } = require('express-validator');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');
const logger = require('../utils/logger');
const { stakingService } = require('../services/blockchain');
const StakingPosition = require('../models/StakingPosition');
const StakingReward = require('../models/StakingReward');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StakingPosition:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user:
 *           type: string
 *         amount:
 *           type: string
 *           description: Staked amount in SKILL tokens
 *         lockPeriod:
 *           type: integer
 *           description: Lock period in seconds
 *         multiplier:
 *           type: number
 *           description: Reward multiplier based on lock period
 *         stakedAt:
 *           type: string
 *           format: date-time
 *         unlocksAt:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [active, unlocked, withdrawn]
 *         totalRewards:
 *           type: string
 *           description: Total rewards earned
 *         lastRewardClaim:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/staking/positions:
 *   get:
 *     summary: Get user's staking positions
 *     tags: [Staking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staking positions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StakingPosition'
 */
router.get('/positions', auth.authenticate, async (req, res) => {
  try {
    const positions = await StakingPosition.find({ user: req.user.id })
      .sort({ stakedAt: -1 });

    // Get current rewards for each position
    const positionsWithRewards = await Promise.all(
      positions.map(async (position) => {
        try {
          const currentRewards = await stakingService.getEarnedRewards(
            req.user.walletAddress,
            position.contractPositionId
          );
          
          return {
            ...position.toObject(),
            currentRewards
          };
        } catch (error) {
          logger.error('Error fetching rewards for position:', error);
          return {
            ...position.toObject(),
            currentRewards: '0'
          };
        }
      })
    );

    res.json({
      success: true,
      data: positionsWithRewards
    });
  } catch (error) {
    logger.error('Error fetching staking positions:', error);
    res.status(500).json({ error: 'Failed to fetch staking positions' });
  }
});

/**
 * @swagger
 * /api/staking/stake:
 *   post:
 *     summary: Create a new staking position
 *     tags: [Staking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - lockPeriod
 *               - transactionHash
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Amount to stake in SKILL tokens
 *               lockPeriod:
 *                 type: integer
 *                 description: Lock period in seconds (0, 2592000, 7776000, 15552000, 31536000)
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *     responses:
 *       201:
 *         description: Staking position created successfully
 *       400:
 *         description: Invalid input or transaction
 */
router.post('/stake',
  auth.authenticate,
  [
    body('amount').isNumeric().custom(value => {
      const amount = parseFloat(value);
      if (amount < 100) {
        throw new Error('Minimum stake amount is 100 SKILL tokens');
      }
      return true;
    }),
    body('lockPeriod').isInt().isIn([0, 2592000, 7776000, 15552000, 31536000]), // 0, 30, 90, 180, 365 days
    body('transactionHash').matches(/^0x[a-fA-F0-9]{64}$/)
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { amount, lockPeriod, transactionHash } = req.body;

      // Verify transaction on blockchain
      const transaction = await stakingService.verifyStakeTransaction(
        transactionHash,
        req.user.walletAddress,
        amount,
        lockPeriod
      );

      if (!transaction.success) {
        return res.status(400).json({ 
          error: 'Invalid transaction',
          details: transaction.error
        });
      }

      // Calculate multiplier based on lock period
      const multipliers = {
        0: 1.0,        // No lock
        2592000: 1.1,   // 30 days
        7776000: 1.25,  // 90 days
        15552000: 1.5,  // 180 days
        31536000: 2.0   // 365 days
      };

      const multiplier = multipliers[lockPeriod];
      const unlocksAt = lockPeriod > 0 ? new Date(Date.now() + lockPeriod * 1000) : null;

      // Create staking position
      const position = new StakingPosition({
        user: req.user.id,
        amount,
        lockPeriod,
        multiplier,
        stakedAt: new Date(),
        unlocksAt,
        status: 'active',
        transactionHash,
        contractPositionId: transaction.positionId
      });

      await position.save();

      // Emit real-time update
      req.io.to(`user:${req.user.id}`).emit('staking-position-created', position);

      res.status(201).json({
        success: true,
        message: 'Staking position created successfully',
        data: position
      });
    } catch (error) {
      logger.error('Error creating staking position:', error);
      res.status(500).json({ error: 'Failed to create staking position' });
    }
  }
);

/**
 * @swagger
 * /api/staking/unstake/{positionId}:
 *   post:
 *     summary: Unstake tokens from a position
 *     tags: [Staking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: positionId
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
 *               - amount
 *               - transactionHash
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Amount to unstake
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *     responses:
 *       200:
 *         description: Unstaking successful
 *       400:
 *         description: Invalid request or tokens still locked
 *       404:
 *         description: Staking position not found
 */
router.post('/unstake/:positionId',
  auth.authenticate,
  [
    param('positionId').isMongoId(),
    body('amount').isNumeric(),
    body('transactionHash').matches(/^0x[a-fA-F0-9]{64}$/)
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { amount, transactionHash } = req.body;
      const { positionId } = req.params;

      const position = await StakingPosition.findOne({
        _id: positionId,
        user: req.user.id
      });

      if (!position) {
        return res.status(404).json({ error: 'Staking position not found' });
      }

      if (position.status !== 'active') {
        return res.status(400).json({ error: 'Position is not active' });
      }

      // Check if tokens are still locked
      if (position.unlocksAt && new Date() < position.unlocksAt) {
        return res.status(400).json({ 
          error: 'Tokens are still locked',
          unlocksAt: position.unlocksAt
        });
      }

      // Verify unstake transaction
      const transaction = await stakingService.verifyUnstakeTransaction(
        transactionHash,
        req.user.walletAddress,
        position.contractPositionId,
        amount
      );

      if (!transaction.success) {
        return res.status(400).json({ 
          error: 'Invalid transaction',
          details: transaction.error
        });
      }

      // Update position
      const remainingAmount = parseFloat(position.amount) - parseFloat(amount);
      
      if (remainingAmount <= 0) {
        position.status = 'withdrawn';
        position.withdrawnAt = new Date();
      } else {
        position.amount = remainingAmount.toString();
      }

      await position.save();

      // Emit real-time update
      req.io.to(`user:${req.user.id}`).emit('staking-position-updated', position);

      res.json({
        success: true,
        message: 'Unstaking successful',
        data: position
      });
    } catch (error) {
      logger.error('Error unstaking:', error);
      res.status(500).json({ error: 'Failed to unstake tokens' });
    }
  }
);

/**
 * @swagger
 * /api/staking/claim-rewards/{positionId}:
 *   post:
 *     summary: Claim staking rewards
 *     tags: [Staking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: positionId
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
 *         description: Rewards claimed successfully
 *       404:
 *         description: Staking position not found
 */
router.post('/claim-rewards/:positionId',
  auth.authenticate,
  [
    param('positionId').isMongoId(),
    body('transactionHash').matches(/^0x[a-fA-F0-9]{64}$/)
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { transactionHash } = req.body;
      const { positionId } = req.params;

      const position = await StakingPosition.findOne({
        _id: positionId,
        user: req.user.id
      });

      if (!position) {
        return res.status(404).json({ error: 'Staking position not found' });
      }

      // Verify claim transaction
      const transaction = await stakingService.verifyClaimTransaction(
        transactionHash,
        req.user.walletAddress,
        position.contractPositionId
      );

      if (!transaction.success) {
        return res.status(400).json({ 
          error: 'Invalid transaction',
          details: transaction.error
        });
      }

      // Record reward claim
      const reward = new StakingReward({
        user: req.user.id,
        stakingPosition: positionId,
        amount: transaction.rewardAmount,
        claimedAt: new Date(),
        transactionHash
      });

      await reward.save();

      // Update position
      position.totalRewards = (parseFloat(position.totalRewards || '0') + parseFloat(transaction.rewardAmount)).toString();
      position.lastRewardClaim = new Date();
      await position.save();

      // Emit real-time update
      req.io.to(`user:${req.user.id}`).emit('rewards-claimed', {
        position,
        reward
      });

      res.json({
        success: true,
        message: 'Rewards claimed successfully',
        data: {
          position,
          reward
        }
      });
    } catch (error) {
      logger.error('Error claiming rewards:', error);
      res.status(500).json({ error: 'Failed to claim rewards' });
    }
  }
);

/**
 * @swagger
 * /api/staking/rewards:
 *   get:
 *     summary: Get user's staking rewards history
 *     tags: [Staking]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Rewards history retrieved successfully
 */
router.get('/rewards',
  auth.authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [rewards, total] = await Promise.all([
        StakingReward.find({ user: req.user.id })
          .populate('stakingPosition', 'amount lockPeriod multiplier')
          .sort({ claimedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        StakingReward.countDocuments({ user: req.user.id })
      ]);

      res.json({
        success: true,
        data: rewards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching staking rewards:', error);
      res.status(500).json({ error: 'Failed to fetch staking rewards' });
    }
  }
);

/**
 * @swagger
 * /api/staking/stats:
 *   get:
 *     summary: Get staking statistics
 *     tags: [Staking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staking statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalStaked:
 *                       type: string
 *                     totalRewards:
 *                       type: string
 *                     activePositions:
 *                       type: integer
 *                     averageAPY:
 *                       type: number
 */
router.get('/stats', auth.authenticate, async (req, res) => {
  try {
    const [positions, rewards, globalStats] = await Promise.all([
      StakingPosition.find({ user: req.user.id }),
      StakingReward.find({ user: req.user.id }),
      stakingService.getGlobalStakingStats()
    ]);

    const totalStaked = positions
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const totalRewards = rewards
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const activePositions = positions.filter(p => p.status === 'active').length;

    // Calculate average APY based on user's positions
    const weightedAPY = positions
      .filter(p => p.status === 'active')
      .reduce((sum, p) => {
        const baseAPY = 10; // 10% base APY
        const multipliedAPY = baseAPY * p.multiplier;
        const weight = parseFloat(p.amount) / totalStaked;
        return sum + (multipliedAPY * weight);
      }, 0);

    res.json({
      success: true,
      data: {
        totalStaked: totalStaked.toString(),
        totalRewards: totalRewards.toString(),
        activePositions,
        averageAPY: weightedAPY || 0,
        globalStats
      }
    });
  } catch (error) {
    logger.error('Error fetching staking stats:', error);
    res.status(500).json({ error: 'Failed to fetch staking statistics' });
  }
});

/**
 * @swagger
 * /api/staking/apy-calculator:
 *   post:
 *     summary: Calculate APY for staking parameters
 *     tags: [Staking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - lockPeriod
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Amount to stake
 *               lockPeriod:
 *                 type: integer
 *                 description: Lock period in seconds
 *     responses:
 *       200:
 *         description: APY calculation successful
 */
router.post('/apy-calculator',
  [
    body('amount').isNumeric(),
    body('lockPeriod').isInt().isIn([0, 2592000, 7776000, 15552000, 31536000])
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { amount, lockPeriod } = req.body;

      const multipliers = {
        0: 1.0,        // No lock
        2592000: 1.1,   // 30 days
        7776000: 1.25,  // 90 days
        15552000: 1.5,  // 180 days
        31536000: 2.0   // 365 days
      };

      const baseAPY = 10; // 10% base APY
      const multiplier = multipliers[lockPeriod];
      const effectiveAPY = baseAPY * multiplier;

      const yearlyRewards = (parseFloat(amount) * effectiveAPY) / 100;
      const monthlyRewards = yearlyRewards / 12;
      const dailyRewards = yearlyRewards / 365;

      res.json({
        success: true,
        data: {
          amount,
          lockPeriod,
          lockPeriodDays: lockPeriod / 86400,
          multiplier,
          baseAPY,
          effectiveAPY,
          projectedRewards: {
            daily: dailyRewards.toFixed(6),
            monthly: monthlyRewards.toFixed(6),
            yearly: yearlyRewards.toFixed(6)
          }
        }
      });
    } catch (error) {
      logger.error('Error calculating APY:', error);
      res.status(500).json({ error: 'Failed to calculate APY' });
    }
  }
);

module.exports = router;