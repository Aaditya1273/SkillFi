const express = require('express');
const { body, param, query } = require('express-validator');
const Review = require('../models/Review');
const Contract = require('../models/Contract');
const User = require('../models/User');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         contract:
 *           type: string
 *         reviewer:
 *           $ref: '#/components/schemas/User'
 *         reviewee:
 *           $ref: '#/components/schemas/User'
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         title:
 *           type: string
 *         comment:
 *           type: string
 *         categories:
 *           type: object
 *           properties:
 *             communication:
 *               type: integer
 *               minimum: 1
 *               maximum: 5
 *             quality:
 *               type: integer
 *               minimum: 1
 *               maximum: 5
 *             timeliness:
 *               type: integer
 *               minimum: 1
 *               maximum: 5
 *             professionalism:
 *               type: integer
 *               minimum: 1
 *               maximum: 5
 *         isPublic:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Get reviews with filtering
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Get reviews for specific user
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter by rating
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
 *         description: Reviews retrieved successfully
 */
router.get('/',
  [
    query('userId').optional().isMongoId(),
    query('rating').optional().isInt({ min: 1, max: 5 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { userId, rating, page = 1, limit = 20 } = req.query;

      const query = { isPublic: true };

      if (userId) {
        query.reviewee = userId;
      }

      if (rating) {
        query.rating = parseInt(rating);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [reviews, total] = await Promise.all([
        Review.find(query)
          .populate('reviewer', 'firstName lastName username avatar')
          .populate('reviewee', 'firstName lastName username avatar')
          .populate('contract', 'job')
          .populate({
            path: 'contract',
            populate: {
              path: 'job',
              select: 'title category'
            }
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Review.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching reviews:', error);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }
);

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Submit a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractId
 *               - rating
 *               - title
 *               - comment
 *             properties:
 *               contractId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *                 maxLength: 100
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *               categories:
 *                 type: object
 *                 properties:
 *                   communication:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   quality:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   timeliness:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   professionalism:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Review submitted successfully
 *       400:
 *         description: Invalid input or review already exists
 *       403:
 *         description: Not authorized to review this contract
 */
router.post('/',
  auth.authenticate,
  [
    body('contractId').isMongoId().withMessage('Valid contract ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
    body('comment').trim().isLength({ min: 10, max: 1000 }).withMessage('Comment must be 10-1000 characters'),
    body('categories.communication').optional().isInt({ min: 1, max: 5 }),
    body('categories.quality').optional().isInt({ min: 1, max: 5 }),
    body('categories.timeliness').optional().isInt({ min: 1, max: 5 }),
    body('categories.professionalism').optional().isInt({ min: 1, max: 5 }),
    body('isPublic').optional().isBoolean()
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { contractId, rating, title, comment, categories = {}, isPublic = true } = req.body;

      // Verify contract exists and is completed
      const contract = await Contract.findById(contractId)
        .populate('client', '_id')
        .populate('freelancer', '_id');

      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      if (contract.status !== 'completed') {
        return res.status(400).json({ error: 'Can only review completed contracts' });
      }

      // Check if user is involved in the contract
      const isClient = contract.client._id.toString() === req.user.id;
      const isFreelancer = contract.freelancer._id.toString() === req.user.id;

      if (!isClient && !isFreelancer) {
        return res.status(403).json({ error: 'Not authorized to review this contract' });
      }

      // Determine reviewee (the other party)
      const revieweeId = isClient ? contract.freelancer._id : contract.client._id;

      // Check if review already exists
      const existingReview = await Review.findOne({
        contract: contractId,
        reviewer: req.user.id
      });

      if (existingReview) {
        return res.status(400).json({ error: 'You have already reviewed this contract' });
      }

      // Create review
      const review = new Review({
        contract: contractId,
        reviewer: req.user.id,
        reviewee: revieweeId,
        rating,
        title,
        comment,
        categories,
        isPublic,
        reviewerRole: isClient ? 'client' : 'freelancer'
      });

      await review.save();

      // Update reviewee's reputation
      await updateUserReputation(revieweeId, rating);

      // Populate review data for response
      await review.populate([
        { path: 'reviewer', select: 'firstName lastName username avatar' },
        { path: 'reviewee', select: 'firstName lastName username avatar' },
        { path: 'contract', select: 'job', populate: { path: 'job', select: 'title category' } }
      ]);

      // Emit real-time notification
      req.io.to(`user:${revieweeId}`).emit('review-received', {
        review,
        message: 'You received a new review!'
      });

      logger.info('Review submitted successfully', {
        reviewId: review._id,
        contractId,
        reviewerId: req.user.id,
        revieweeId,
        rating
      });

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: review
      });

    } catch (error) {
      logger.error('Error submitting review:', error);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   get:
 *     summary: Get review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review retrieved successfully
 *       404:
 *         description: Review not found
 */
router.get('/:id',
  [param('id').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const review = await Review.findById(req.params.id)
        .populate('reviewer', 'firstName lastName username avatar')
        .populate('reviewee', 'firstName lastName username avatar')
        .populate({
          path: 'contract',
          select: 'job amount',
          populate: {
            path: 'job',
            select: 'title category description'
          }
        });

      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }

      // Check if review is public or user is involved
      const isInvolved = req.user && (
        review.reviewer._id.toString() === req.user.id ||
        review.reviewee._id.toString() === req.user.id
      );

      if (!review.isPublic && !isInvolved) {
        return res.status(403).json({ error: 'Review is private' });
      }

      res.json({
        success: true,
        data: review
      });
    } catch (error) {
      logger.error('Error fetching review:', error);
      res.status(500).json({ error: 'Failed to fetch review' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   put:
 *     summary: Update review (reviewer only, within 24 hours)
 *     tags: [Reviews]
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
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *                 maxLength: 100
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *               categories:
 *                 type: object
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       400:
 *         description: Review cannot be updated (too old)
 *       403:
 *         description: Not authorized to update this review
 */
router.put('/:id',
  auth.authenticate,
  [
    param('id').isMongoId(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('title').optional().trim().isLength({ min: 5, max: 100 }),
    body('comment').optional().trim().isLength({ min: 10, max: 1000 }),
    body('categories.communication').optional().isInt({ min: 1, max: 5 }),
    body('categories.quality').optional().isInt({ min: 1, max: 5 }),
    body('categories.timeliness').optional().isInt({ min: 1, max: 5 }),
    body('categories.professionalism').optional().isInt({ min: 1, max: 5 }),
    body('isPublic').optional().isBoolean()
  ],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const review = await Review.findById(req.params.id);

      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (review.reviewer.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to update this review' });
      }

      // Check if review is within 24 hours (editable period)
      const hoursSinceCreation = (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return res.status(400).json({ error: 'Reviews can only be edited within 24 hours of creation' });
      }

      // Update allowed fields
      const allowedUpdates = ['rating', 'title', 'comment', 'categories', 'isPublic'];
      const updates = {};
      
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // If rating changed, update user reputation
      if (updates.rating && updates.rating !== review.rating) {
        await updateUserReputation(review.reviewee, updates.rating, review.rating);
      }

      const updatedReview = await Review.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate([
        { path: 'reviewer', select: 'firstName lastName username avatar' },
        { path: 'reviewee', select: 'firstName lastName username avatar' },
        { path: 'contract', select: 'job', populate: { path: 'job', select: 'title category' } }
      ]);

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: updatedReview
      });

    } catch (error) {
      logger.error('Error updating review:', error);
      res.status(500).json({ error: 'Failed to update review' });
    }
  }
);

/**
 * @swagger
 * /api/reviews/user/{userId}/stats:
 *   get:
 *     summary: Get user's review statistics
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review statistics retrieved successfully
 */
router.get('/user/:userId/stats',
  [param('userId').isMongoId()],
  validation.handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;

      const [reviews, ratingDistribution] = await Promise.all([
        Review.find({ reviewee: userId, isPublic: true }),
        Review.aggregate([
          { $match: { reviewee: mongoose.Types.ObjectId(userId), isPublic: true } },
          { $group: { _id: '$rating', count: { $sum: 1 } } },
          { $sort: { _id: -1 } }
        ])
      ]);

      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
        : 0;

      // Calculate category averages
      const categoryAverages = {
        communication: 0,
        quality: 0,
        timeliness: 0,
        professionalism: 0
      };

      const reviewsWithCategories = reviews.filter(r => r.categories && Object.keys(r.categories).length > 0);
      
      if (reviewsWithCategories.length > 0) {
        Object.keys(categoryAverages).forEach(category => {
          const categoryReviews = reviewsWithCategories.filter(r => r.categories[category]);
          if (categoryReviews.length > 0) {
            categoryAverages[category] = categoryReviews.reduce((sum, r) => sum + r.categories[category], 0) / categoryReviews.length;
          }
        });
      }

      // Format rating distribution
      const distribution = {};
      for (let i = 1; i <= 5; i++) {
        distribution[i] = 0;
      }
      ratingDistribution.forEach(item => {
        distribution[item._id] = item.count;
      });

      res.json({
        success: true,
        data: {
          totalReviews,
          averageRating: Math.round(averageRating * 10) / 10,
          ratingDistribution: distribution,
          categoryAverages,
          recentReviews: reviews.slice(0, 5).map(review => ({
            id: review._id,
            rating: review.rating,
            title: review.title,
            comment: review.comment.substring(0, 100) + (review.comment.length > 100 ? '...' : ''),
            createdAt: review.createdAt,
            reviewer: review.reviewer
          }))
        }
      });

    } catch (error) {
      logger.error('Error fetching review stats:', error);
      res.status(500).json({ error: 'Failed to fetch review statistics' });
    }
  }
);

// Helper function to update user reputation
async function updateUserReputation(userId, newRating, oldRating = null) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    if (oldRating) {
      // Update existing review - adjust the average
      const totalRating = user.reputation * user.totalReviews;
      const adjustedTotal = totalRating - oldRating + newRating;
      user.reputation = adjustedTotal / user.totalReviews;
    } else {
      // New review - recalculate average
      const totalRating = user.reputation * user.totalReviews + newRating;
      user.totalReviews += 1;
      user.reputation = totalRating / user.totalReviews;
    }

    // Round to 2 decimal places
    user.reputation = Math.round(user.reputation * 100) / 100;
    
    await user.save();
  } catch (error) {
    logger.error('Error updating user reputation:', error);
  }
}

module.exports = router;