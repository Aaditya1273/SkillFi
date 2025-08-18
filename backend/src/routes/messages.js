const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Send message
router.post('/',
  auth,
  [
    body('projectId').isString(),
    body('receiverId').isString(),
    body('content').trim().isLength({ min: 1, max: 1000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { projectId, receiverId, content } = req.body;

      // Verify project exists and user is involved
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const isAuthorized = project.clientId === req.user.id || 
                          project.freelancerId === req.user.id;

      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to send messages for this project' });
      }

      // Verify receiver is involved in the project
      const isReceiverAuthorized = project.clientId === receiverId || 
                                  project.freelancerId === receiverId;

      if (!isReceiverAuthorized) {
        return res.status(400).json({ error: 'Receiver is not involved in this project' });
      }

      const message = await prisma.message.create({
        data: {
          projectId,
          senderId: req.user.id,
          receiverId,
          content
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        }
      });

      // Emit real-time message via Socket.IO
      req.io.to(`project-${projectId}`).emit('new-message', message);

      res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Get messages for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is involved in the project
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isAuthorized = project.clientId === req.user.id || 
                        project.freelancerId === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to view messages for this project' });
    }

    const skip = (page - 1) * limit;

    const messages = await prisma.message.findMany({
      where: { projectId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    // Mark messages as read for the current user
    await prisma.message.updateMany({
      where: {
        projectId,
        receiverId: req.user.id,
        isRead: false
      },
      data: { isRead: true }
    });

    res.json(messages.reverse()); // Return in chronological order
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: {
        receiverId: req.user.id,
        isRead: false
      }
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Get conversations (projects with messages)
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await prisma.project.findMany({
      where: {
        OR: [
          { clientId: req.user.id },
          { freelancerId: req.user.id }
        ],
        messages: {
          some: {}
        }
      },
      include: {
        client: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        freelancer: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                receiverId: req.user.id,
                isRead: false
              }
            }
          }
        }
      },
      orderBy: {
        messages: {
          _count: 'desc'
        }
      }
    });

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

module.exports = router;