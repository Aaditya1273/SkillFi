const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Submit proposal
router.post('/',
  auth,
  [
    body('projectId').isString(),
    body('bidAmount').isFloat({ min: 0.01 }),
    body('description').trim().isLength({ min: 20, max: 1000 }),
    body('deliveryTime').isInt({ min: 1, max: 365 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { projectId, bidAmount, description, deliveryTime } = req.body;

      // Check if project exists and is open
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.status !== 'OPEN') {
        return res.status(400).json({ error: 'Project is not open for proposals' });
      }

      if (project.clientId === req.user.id) {
        return res.status(400).json({ error: 'Cannot submit proposal to your own project' });
      }

      // Check if user already submitted a proposal
      const existingProposal = await prisma.proposal.findUnique({
        where: {
          projectId_freelancerId: {
            projectId,
            freelancerId: req.user.id
          }
        }
      });

      if (existingProposal) {
        return res.status(400).json({ error: 'You have already submitted a proposal for this project' });
      }

      const proposal = await prisma.proposal.create({
        data: {
          projectId,
          freelancerId: req.user.id,
          bidAmount: parseFloat(bidAmount),
          description,
          deliveryTime: parseInt(deliveryTime)
        },
        include: {
          freelancer: {
            select: {
              id: true,
              username: true,
              avatar: true,
              reputation: true,
              skills: true
            }
          },
          project: {
            select: {
              id: true,
              title: true,
              client: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        }
      });

      res.status(201).json(proposal);
    } catch (error) {
      console.error('Error creating proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  }
);

// Get proposals for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check if user is the project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view proposals for this project' });
    }

    const proposals = await prisma.proposal.findMany({
      where: { projectId },
      include: {
        freelancer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            reputation: true,
            skills: true,
            hourlyRate: true,
            location: true,
            _count: {
              select: {
                freelancerProjects: {
                  where: { status: 'COMPLETED' }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// Accept proposal
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        freelancer: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to accept this proposal' });
    }

    if (proposal.project.status !== 'OPEN') {
      return res.status(400).json({ error: 'Project is not open' });
    }

    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ error: 'Proposal is not pending' });
    }

    // Update proposal and project in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Accept the proposal
      const acceptedProposal = await tx.proposal.update({
        where: { id: req.params.id },
        data: { status: 'ACCEPTED' }
      });

      // Update project status and assign freelancer
      await tx.project.update({
        where: { id: proposal.projectId },
        data: {
          status: 'IN_PROGRESS',
          freelancerId: proposal.freelancerId
        }
      });

      // Reject all other proposals for this project
      await tx.proposal.updateMany({
        where: {
          projectId: proposal.projectId,
          id: { not: req.params.id }
        },
        data: { status: 'REJECTED' }
      });

      return acceptedProposal;
    });

    res.json({
      message: 'Proposal accepted successfully',
      proposal: result
    });
  } catch (error) {
    console.error('Error accepting proposal:', error);
    res.status(500).json({ error: 'Failed to accept proposal' });
  }
});

// Reject proposal
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this proposal' });
    }

    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ error: 'Proposal is not pending' });
    }

    const rejectedProposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' }
    });

    res.json({
      message: 'Proposal rejected successfully',
      proposal: rejectedProposal
    });
  } catch (error) {
    console.error('Error rejecting proposal:', error);
    res.status(500).json({ error: 'Failed to reject proposal' });
  }
});

// Get user's proposals
router.get('/my-proposals', auth, async (req, res) => {
  try {
    const proposals = await prisma.proposal.findMany({
      where: { freelancerId: req.user.id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            budget: true,
            status: true,
            deadline: true,
            client: {
              select: {
                id: true,
                username: true,
                avatar: true,
                reputation: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(proposals);
  } catch (error) {
    console.error('Error fetching user proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

module.exports = router;