const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();

// Generate or get existing referral code for user
router.post('/generate', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has a referral code
    let referralCode = await prisma.referralCode.findFirst({
      where: { ownerId: userId }
    });

    if (!referralCode) {
      // Generate unique code
      let code;
      let isUnique = false;
      
      while (!isUnique) {
        code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const existing = await prisma.referralCode.findUnique({
          where: { code }
        });
        if (!existing) isUnique = true;
      }

      referralCode = await prisma.referralCode.create({
        data: {
          code,
          ownerId: userId,
          maxUses: 100, // Default limit
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        }
      });
    }

    res.json({
      code: referralCode.code,
      usesCount: referralCode.usesCount,
      maxUses: referralCode.maxUses,
      expiresAt: referralCode.expiresAt,
      referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${referralCode.code}`
    });
  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({ error: 'Failed to generate referral code' });
  }
});

// Accept referral code during signup
router.post('/accept', 
  [
    body('referralCode').isString().isLength({ min: 1, max: 20 }),
    body('refereeId').isString(),
    body('role').isIn(['FREELANCER', 'CLIENT'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { referralCode, refereeId, role } = req.body;

      // Check if referee already has a referral
      const existingReferral = await prisma.referral.findUnique({
        where: { refereeId }
      });

      if (existingReferral) {
        return res.status(400).json({ error: 'User already has a referral' });
      }

      // Find referral code
      const code = await prisma.referralCode.findUnique({
        where: { code: referralCode },
        include: { owner: true }
      });

      if (!code) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      // Check if code is expired
      if (code.expiresAt && new Date() > code.expiresAt) {
        return res.status(400).json({ error: 'Referral code has expired' });
      }

      // Check if code has reached max uses
      if (code.maxUses && code.usesCount >= code.maxUses) {
        return res.status(400).json({ error: 'Referral code has reached maximum uses' });
      }

      // Check if user is trying to refer themselves
      if (code.ownerId === refereeId) {
        return res.status(400).json({ error: 'Cannot refer yourself' });
      }

      // Create referral and update counts
      const result = await prisma.$transaction(async (tx) => {
        // Create referral record
        const referral = await tx.referral.create({
          data: {
            referrerId: code.ownerId,
            refereeId,
            codeId: code.id,
            role
          }
        });

        // Update referral code usage count
        await tx.referralCode.update({
          where: { id: code.id },
          data: { usesCount: { increment: 1 } }
        });

        // Update referrer's referral count
        await tx.user.update({
          where: { id: code.ownerId },
          data: { 
            referralCount: { increment: 1 },
            totalEarned: { increment: 50 } // 50 tokens reward for referrer
          }
        });

        // Update referee's referred by and give signup bonus
        await tx.user.update({
          where: { id: refereeId },
          data: { 
            referredById: code.ownerId,
            totalEarned: { increment: 10 } // 10 tokens reward for referee
          }
        });

        return referral;
      });

      res.json({
        success: true,
        referral: result,
        rewards: {
          referrer: 50,
          referee: 10
        }
      });
    } catch (error) {
      console.error('Accept referral error:', error);
      res.status(500).json({ error: 'Failed to accept referral' });
    }
  }
);

// Get user's referral stats
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's referral code
    const referralCode = await prisma.referralCode.findFirst({
      where: { ownerId: userId }
    });

    // Get referrals made by user
    const referralsMade = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referee: {
          select: { id: true, username: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get user's current referral count
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCount: true, referredById: true }
    });

    res.json({
      referralCode: referralCode ? {
        code: referralCode.code,
        usesCount: referralCode.usesCount,
        maxUses: referralCode.maxUses,
        expiresAt: referralCode.expiresAt,
        referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${referralCode.code}`
      } : null,
      referralCount: user.referralCount,
      referralsMade,
      wasReferred: !!user.referredById
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

// Get leaderboard
router.get('/leaderboard',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('timeframe').optional().isIn(['week', 'month', 'all'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const limit = parseInt(req.query.limit) || 10;
      const timeframe = req.query.timeframe || 'all';

      let whereClause = {};
      
      if (timeframe !== 'all') {
        const now = new Date();
        let startDate;
        
        if (timeframe === 'week') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeframe === 'month') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        
        whereClause.createdAt = { gte: startDate };
      }

      // Get top referrers
      const topReferrers = await prisma.user.findMany({
        where: {
          referralCount: { gt: 0 }
        },
        select: {
          id: true,
          username: true,
          avatar: true,
          referralCount: true,
          referralsMade: timeframe === 'all' ? false : {
            where: whereClause,
            select: { id: true }
          }
        },
        orderBy: { referralCount: 'desc' },
        take: limit
      });

      // If filtering by timeframe, recalculate counts
      let leaderboard = topReferrers;
      if (timeframe !== 'all') {
        leaderboard = topReferrers.map(user => ({
          ...user,
          referralCount: user.referralsMade.length,
          referralsMade: undefined
        })).filter(user => user.referralCount > 0)
        .sort((a, b) => b.referralCount - a.referralCount);
      }

      res.json({
        leaderboard,
        timeframe,
        total: leaderboard.length
      });
    } catch (error) {
      console.error('Get leaderboard error:', error);
      res.status(500).json({ error: 'Failed to get leaderboard' });
    }
  }
);

// Get referral code info (public endpoint)
router.get('/:code',
  [param('code').isString().isLength({ min: 1, max: 20 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { code } = req.params;

      const referralCode = await prisma.referralCode.findUnique({
        where: { code },
        include: {
          owner: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });

      if (!referralCode) {
        return res.status(404).json({ error: 'Referral code not found' });
      }

      const isExpired = referralCode.expiresAt && new Date() > referralCode.expiresAt;
      const isMaxedOut = referralCode.maxUses && referralCode.usesCount >= referralCode.maxUses;

      res.json({
        code: referralCode.code,
        owner: referralCode.owner,
        usesCount: referralCode.usesCount,
        maxUses: referralCode.maxUses,
        expiresAt: referralCode.expiresAt,
        isValid: !isExpired && !isMaxedOut,
        isExpired,
        isMaxedOut
      });
    } catch (error) {
      console.error('Get referral code info error:', error);
      res.status(500).json({ error: 'Failed to get referral code info' });
    }
  }
);

module.exports = router;
