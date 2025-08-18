const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all users (freelancers) with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      skills,
      minRate,
      maxRate,
      location,
      search
    } = req.query;

    const skip = (page - 1) * limit;
    const where = {};

    if (skills) {
      where.skills = {
        hasSome: skills.split(',')
      };
    }
    if (minRate || maxRate) {
      where.hourlyRate = {};
      if (minRate) where.hourlyRate.gte = parseFloat(minRate);
      if (maxRate) where.hourlyRate.lte = parseFloat(maxRate);
    }
    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive'
      };
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          bio: true,
          avatar: true,
          skills: true,
          hourlyRate: true,
          location: true,
          reputation: true,
          totalEarned: true,
          createdAt: true,
          _count: {
            select: {
              freelancerProjects: {
                where: { status: 'COMPLETED' }
              }
            }
          }
        },
        orderBy: { reputation: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user profile
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        skills: true,
        hourlyRate: true,
        location: true,
        timezone: true,
        reputation: true,
        totalEarned: true,
        createdAt: true,
        freelancerProjects: {
          where: { status: 'COMPLETED' },
          select: {
            id: true,
            title: true,
            budget: true,
            createdAt: true,
            client: {
              select: {
                username: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        receivedReviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
            author: {
              select: {
                username: true,
                avatar: true
              }
            },
            project: {
              select: {
                title: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            freelancerProjects: {
              where: { status: 'COMPLETED' }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/profile',
  auth,
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('skills').optional().isArray({ max: 20 }),
    body('hourlyRate').optional().isFloat({ min: 0 }),
    body('location').optional().trim().isLength({ max: 100 }),
    body('timezone').optional().trim().isLength({ max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: req.body,
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          bio: true,
          avatar: true,
          skills: true,
          hourlyRate: true,
          location: true,
          timezone: true,
          reputation: true,
          totalEarned: true
        }
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

module.exports = router;