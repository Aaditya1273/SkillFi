const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all projects with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      skills,
      minBudget,
      maxBudget,
      status = 'OPEN',
      search
    } = req.query;

    const skip = (page - 1) * limit;
    const where = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (minBudget || maxBudget) {
      where.budget = {};
      if (minBudget) where.budget.gte = parseFloat(minBudget);
      if (maxBudget) where.budget.lte = parseFloat(maxBudget);
    }
    if (skills) {
      where.skills = {
        hasSome: skills.split(',')
      };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          client: {
            select: {
              id: true,
              username: true,
              avatar: true,
              reputation: true
            }
          },
          _count: {
            select: { proposals: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.project.count({ where })
    ]);

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            username: true,
            avatar: true,
            reputation: true,
            createdAt: true
          }
        },
        freelancer: {
          select: {
            id: true,
            username: true,
            avatar: true,
            reputation: true
          }
        },
        proposals: {
          include: {
            freelancer: {
              select: {
                id: true,
                username: true,
                avatar: true,
                reputation: true,
                skills: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/',
  auth,
  [
    body('title').trim().isLength({ min: 5, max: 100 }),
    body('description').trim().isLength({ min: 20, max: 2000 }),
    body('budget').isFloat({ min: 0.01 }),
    body('skills').isArray({ min: 1, max: 10 }),
    body('category').optional().trim().isLength({ min: 1, max: 50 }),
    body('deadline').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, budget, skills, category, deadline } = req.body;

      const project = await prisma.project.create({
        data: {
          title,
          description,
          budget: parseFloat(budget),
          skills,
          category,
          deadline: deadline ? new Date(deadline) : null,
          clientId: req.user.id
        },
        include: {
          client: {
            select: {
              id: true,
              username: true,
              avatar: true,
              reputation: true
            }
          }
        }
      });

      res.status(201).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
);

// Update project
router.put('/:id',
  auth,
  [
    body('title').optional().trim().isLength({ min: 5, max: 100 }),
    body('description').optional().trim().isLength({ min: 20, max: 2000 }),
    body('budget').optional().isFloat({ min: 0.01 }),
    body('skills').optional().isArray({ min: 1, max: 10 }),
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const project = await prisma.project.findUnique({
        where: { id: req.params.id }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to update this project' });
      }

      const updatedProject = await prisma.project.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          client: {
            select: {
              id: true,
              username: true,
              avatar: true,
              reputation: true
            }
          }
        }
      });

      res.json(updatedProject);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }
);

// Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this project' });
    }

    if (project.status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Cannot delete project in progress' });
    }

    await prisma.project.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;