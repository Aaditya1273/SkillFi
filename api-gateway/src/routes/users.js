const express = require('express');
const { body, param, query } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/User');
const FreelancerProfile = require('../models/FreelancerProfile');
const ClientProfile = require('../models/ClientProfile');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');
const logger = require('../utils/logger');
const { uploadToS3, deleteFromS3 } = require('../services/fileUpload');

const router = express.Router();

// Multer configuration for file uploads
const upload = multer({
  memory: true,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - userType
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         username:
 *           type: string
 *           description: Unique username
 *         userType:
 *           type: string
 *           enum: [freelancer, client, both]
 *           description: Type of user account
 *         firstName:
 *           type: string
 *           description: First name
 *         lastName:
 *           type: string
 *           description: Last name
 *         avatar:
 *           type: string
 *           description: Avatar image URL
 *         isVerified:
 *           type: boolean
 *           description: Email verification status
 *         walletAddress:
 *           type: string
 *           description: Blockchain wallet address
 *         reputation:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *           description: User reputation score
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation date
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', auth.authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v')
      .populate('freelancerProfile')
      .populate('clientProfile');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   country:
 *                     type: string
 *                   city:
 *                     type: string
 *                   timezone:
 *                     type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', 
  auth.authenticate,
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
    body('bio').optional().trim().isLength({ max: 1000 }),
    body('location.country').optional().trim().isLength({ max: 100 }),
    body('location.city').optional().trim().isLength({ max: 100 }),
    body('location.timezone').optional().trim().isLength({ max: 50 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const updates = req.body;
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -__v');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Emit real-time update
      req.io.to(`user:${req.user.id}`).emit('profile-updated', user);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/avatar',
  auth.authenticate,
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Process image with Sharp
      const processedImage = await sharp(req.file.buffer)
        .resize(300, 300, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Upload to S3 or file storage
      const filename = `avatars/${req.user.id}-${Date.now()}.jpg`;
      const avatarUrl = await uploadToS3(processedImage, filename, 'image/jpeg');

      // Delete old avatar if exists
      const user = await User.findById(req.user.id);
      if (user.avatar) {
        await deleteFromS3(user.avatar);
      }

      // Update user avatar
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: avatarUrl },
        { new: true }
      ).select('-password -__v');

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatar: avatarUrl,
          user: updatedUser
        }
      });
    } catch (error) {
      logger.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

/**
 * @swagger
 * /api/users/freelancer-profile:
 *   get:
 *     summary: Get freelancer profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Freelancer profile retrieved successfully
 *       404:
 *         description: Freelancer profile not found
 */
router.get('/freelancer-profile', auth.authenticate, async (req, res) => {
  try {
    const profile = await FreelancerProfile.findOne({ userId: req.user.id });
    
    if (!profile) {
      return res.status(404).json({ error: 'Freelancer profile not found' });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Error fetching freelancer profile:', error);
    res.status(500).json({ error: 'Failed to fetch freelancer profile' });
  }
});

/**
 * @swagger
 * /api/users/freelancer-profile:
 *   post:
 *     summary: Create or update freelancer profile
 *     tags: [Users]
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
 *               - bio
 *               - skills
 *               - hourlyRate
 *               - experienceLevel
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 100
 *               bio:
 *                 type: string
 *                 maxLength: 2000
 *               skills:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     level:
 *                       type: string
 *                       enum: [beginner, intermediate, advanced, expert]
 *               hourlyRate:
 *                 type: number
 *                 minimum: 1
 *               experienceLevel:
 *                 type: string
 *                 enum: [entry, junior, mid, senior, expert]
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Freelancer profile created/updated successfully
 *       400:
 *         description: Validation error
 */
router.post('/freelancer-profile',
  auth.authenticate,
  [
    body('title').trim().isLength({ min: 5, max: 100 }),
    body('bio').trim().isLength({ min: 50, max: 2000 }),
    body('skills').isArray({ min: 1, max: 20 }),
    body('skills.*.name').trim().isLength({ min: 1, max: 50 }),
    body('skills.*.level').isIn(['beginner', 'intermediate', 'advanced', 'expert']),
    body('hourlyRate').isFloat({ min: 1, max: 10000 }),
    body('experienceLevel').isIn(['entry', 'junior', 'mid', 'senior', 'expert']),
    body('categories').optional().isArray({ max: 5 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const profileData = {
        ...req.body,
        userId: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`.trim()
      };

      const profile = await FreelancerProfile.findOneAndUpdate(
        { userId: req.user.id },
        profileData,
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      );

      // Update user type if not already set
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { userType: 'freelancer' }
      });

      res.json({
        success: true,
        message: 'Freelancer profile saved successfully',
        data: profile
      });
    } catch (error) {
      logger.error('Error saving freelancer profile:', error);
      res.status(500).json({ error: 'Failed to save freelancer profile' });
    }
  }
);

/**
 * @swagger
 * /api/users/client-profile:
 *   get:
 *     summary: Get client profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client profile retrieved successfully
 *       404:
 *         description: Client profile not found
 */
router.get('/client-profile', auth.authenticate, async (req, res) => {
  try {
    const profile = await ClientProfile.findOne({ userId: req.user.id });
    
    if (!profile) {
      return res.status(404).json({ error: 'Client profile not found' });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Error fetching client profile:', error);
    res.status(500).json({ error: 'Failed to fetch client profile' });
  }
});

/**
 * @swagger
 * /api/users/client-profile:
 *   post:
 *     summary: Create or update client profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - companySize
 *               - industry
 *             properties:
 *               companyName:
 *                 type: string
 *                 maxLength: 100
 *               companySize:
 *                 type: string
 *                 enum: [startup, small, medium, large, enterprise]
 *               industry:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               website:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Client profile created/updated successfully
 *       400:
 *         description: Validation error
 */
router.post('/client-profile',
  auth.authenticate,
  [
    body('companyName').trim().isLength({ min: 2, max: 100 }),
    body('companySize').isIn(['startup', 'small', 'medium', 'large', 'enterprise']),
    body('industry').trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('website').optional().isURL()
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const profileData = {
        ...req.body,
        userId: req.user.id
      };

      const profile = await ClientProfile.findOneAndUpdate(
        { userId: req.user.id },
        profileData,
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      );

      // Update user type if not already set
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { userType: 'client' }
      });

      res.json({
        success: true,
        message: 'Client profile saved successfully',
        data: profile
      });
    } catch (error) {
      logger.error('Error saving client profile:', error);
      res.status(500).json({ error: 'Failed to save client profile' });
    }
  }
);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users (freelancers)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: Comma-separated skills
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category filter
 *       - in: query
 *         name: minRate
 *         schema:
 *           type: number
 *         description: Minimum hourly rate
 *       - in: query
 *         name: maxRate
 *         schema:
 *           type: number
 *         description: Maximum hourly rate
 *       - in: query
 *         name: experienceLevel
 *         schema:
 *           type: string
 *         description: Experience level
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('minRate').optional().isFloat({ min: 0 }),
    query('maxRate').optional().isFloat({ min: 0 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const {
        q,
        skills,
        category,
        minRate,
        maxRate,
        experienceLevel,
        page = 1,
        limit = 20
      } = req.query;

      const query = { isActive: true };
      
      // Build search criteria
      if (skills) {
        const skillArray = skills.split(',').map(s => s.trim());
        query['skills.name'] = { $in: skillArray };
      }

      if (category) {
        query.categories = category;
      }

      if (minRate || maxRate) {
        query.hourlyRate = {};
        if (minRate) query.hourlyRate.$gte = parseFloat(minRate);
        if (maxRate) query.hourlyRate.$lte = parseFloat(maxRate);
      }

      if (experienceLevel) {
        query.experienceLevel = experienceLevel;
      }

      // Text search
      if (q) {
        query.$text = { $search: q };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [freelancers, total] = await Promise.all([
        FreelancerProfile.find(query)
          .populate('userId', 'firstName lastName avatar reputation')
          .sort(q ? { score: { $meta: 'textScore' } } : { reputation: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        FreelancerProfile.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: freelancers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error searching users:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */
router.get('/:id',
  [param('id').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-password -email -__v')
        .populate('freelancerProfile')
        .populate('clientProfile');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

/**
 * @swagger
 * /api/users/wallet/connect:
 *   post:
 *     summary: Connect wallet address
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - signature
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet connected successfully
 *       400:
 *         description: Invalid wallet address or signature
 */
router.post('/wallet/connect',
  auth.authenticate,
  [
    body('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/),
    body('signature').isLength({ min: 1 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { walletAddress, signature } = req.body;

      // Verify signature (implement signature verification logic)
      // const isValidSignature = await verifyWalletSignature(walletAddress, signature, req.user.id);
      // if (!isValidSignature) {
      //   return res.status(400).json({ error: 'Invalid signature' });
      // }

      // Check if wallet is already connected to another user
      const existingUser = await User.findOne({ 
        walletAddress,
        _id: { $ne: req.user.id }
      });

      if (existingUser) {
        return res.status(400).json({ 
          error: 'Wallet address already connected to another account' 
        });
      }

      // Update user with wallet address
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { walletAddress },
        { new: true }
      ).select('-password -__v');

      res.json({
        success: true,
        message: 'Wallet connected successfully',
        data: { walletAddress: user.walletAddress }
      });
    } catch (error) {
      logger.error('Error connecting wallet:', error);
      res.status(500).json({ error: 'Failed to connect wallet' });
    }
  }
);

/**
 * @swagger
 * /api/users/settings:
 *   get:
 *     summary: Get user settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settings retrieved successfully
 */
router.get('/settings', auth.authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('settings notifications preferences');

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * @swagger
 * /api/users/settings:
 *   put:
 *     summary: Update user settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *                   sms:
 *                     type: boolean
 *               preferences:
 *                 type: object
 *                 properties:
 *                   language:
 *                     type: string
 *                   timezone:
 *                     type: string
 *                   currency:
 *                     type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put('/settings',
  auth.authenticate,
  [
    body('notifications.email').optional().isBoolean(),
    body('notifications.push').optional().isBoolean(),
    body('notifications.sms').optional().isBoolean(),
    body('preferences.language').optional().isLength({ min: 2, max: 5 }),
    body('preferences.timezone').optional().isLength({ min: 1, max: 50 }),
    body('preferences.currency').optional().isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const updates = {};
      
      if (req.body.notifications) {
        updates.notifications = req.body.notifications;
      }
      
      if (req.body.preferences) {
        updates.preferences = req.body.preferences;
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true }
      ).select('notifications preferences');

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: user
      });
    } catch (error) {
      logger.error('Error updating user settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

module.exports = router;