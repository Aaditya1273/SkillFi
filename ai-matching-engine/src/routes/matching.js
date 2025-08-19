const express = require('express');
const Joi = require('joi');
const MatchingEngine = require('../services/MatchingEngine');
const MatchingOptimizer = require('../services/MatchingOptimizer');
const AnalyticsService = require('../services/AnalyticsService');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');

const router = express.Router();
const matchingEngine = new MatchingEngine();
const matchingOptimizer = new MatchingOptimizer();
const analyticsService = new AnalyticsService();

// Validation schemas
const findMatchesSchema = Joi.object({
  jobPostId: Joi.string().required(),
  options: Joi.object({
    minScore: Joi.number().min(0).max(1).default(0.3),
    limit: Joi.number().min(1).max(100).default(50),
    maxFreelancers: Joi.number().min(1).max(5000).default(1000),
    budgetFilter: Joi.boolean().default(false),
    realTime: Joi.boolean().default(false)
  }).default({})
});

const findJobsSchema = Joi.object({
  freelancerId: Joi.string().required(),
  options: Joi.object({
    minScore: Joi.number().min(0).max(1).default(0.3),
    limit: Joi.number().min(1).max(100).default(50),
    maxJobPosts: Joi.number().min(1).max(5000).default(1000),
    budgetFilter: Joi.boolean().default(false),
    categories: Joi.array().items(Joi.string()).default([])
  }).default({})
});

const batchMatchingSchema = Joi.object({
  jobPostIds: Joi.array().items(Joi.string()).min(1).max(10).required(),
  options: Joi.object({
    minScore: Joi.number().min(0).max(1).default(0.3),
    limit: Joi.number().min(1).max(50).default(20),
    parallel: Joi.boolean().default(true)
  }).default({})
});

/**
 * Find matching freelancers for a job post
 */
router.post('/find-freelancers', async (req, res) => {
  try {
    const { error, value } = findMatchesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { jobPostId, options } = value;
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `matches:${jobPostId}:${JSON.stringify(options)}`;
    const cachedResult = await redisClient.get(cacheKey);
    
    if (cachedResult && !options.realTime) {
      const result = JSON.parse(cachedResult);
      result.cached = true;
      result.cacheAge = Date.now() - result.timestamp;
      
      logger.info(`Returning cached matches for job post ${jobPostId}`);
      return res.json(result);
    }

    // Real-time matching with progress updates
    if (options.realTime && req.io) {
      req.io.to(`job-${jobPostId}`).emit('matching-progress', { 
        status: 'started', 
        progress: 0 
      });
    }

    // Perform matching
    const result = await matchingEngine.findMatches(jobPostId, options);
    
    // Add metadata
    result.timestamp = Date.now();
    result.cached = false;
    result.requestId = req.headers['x-request-id'] || 'unknown';

    // Cache result for 30 minutes
    await redisClient.setex(cacheKey, 1800, JSON.stringify(result));

    // Track analytics
    await analyticsService.trackMatching({
      type: 'find_freelancers',
      jobPostId,
      matchesFound: result.matches.length,
      processingTime: result.metadata.processingTime,
      userId: req.user.id
    });

    // Send real-time update
    if (options.realTime && req.io) {
      req.io.to(`job-${jobPostId}`).emit('matching-complete', {
        status: 'completed',
        matchesFound: result.matches.length,
        processingTime: result.metadata.processingTime
      });
    }

    logger.info(`Found ${result.matches.length} matches for job post ${jobPostId} in ${Date.now() - startTime}ms`);
    res.json(result);

  } catch (error) {
    logger.error('Error in find-freelancers:', error);
    
    if (req.io) {
      req.io.to(`job-${req.body.jobPostId}`).emit('matching-error', {
        error: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to find matches',
      message: error.message 
    });
  }
});

/**
 * Find matching job posts for a freelancer
 */
router.post('/find-jobs', async (req, res) => {
  try {
    const { error, value } = findJobsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { freelancerId, options } = value;
    const startTime = Date.now();

    // Check cache
    const cacheKey = `jobs:${freelancerId}:${JSON.stringify(options)}`;
    const cachedResult = await redisClient.get(cacheKey);
    
    if (cachedResult) {
      const result = JSON.parse(cachedResult);
      result.cached = true;
      result.cacheAge = Date.now() - result.timestamp;
      
      logger.info(`Returning cached job matches for freelancer ${freelancerId}`);
      return res.json(result);
    }

    // Perform matching
    const result = await matchingEngine.findJobsForFreelancer(freelancerId, options);
    
    // Add metadata
    result.timestamp = Date.now();
    result.cached = false;
    result.requestId = req.headers['x-request-id'] || 'unknown';

    // Cache result for 15 minutes (jobs change more frequently)
    await redisClient.setex(cacheKey, 900, JSON.stringify(result));

    // Track analytics
    await analyticsService.trackMatching({
      type: 'find_jobs',
      freelancerId,
      matchesFound: result.matches.length,
      processingTime: result.metadata.processingTime,
      userId: req.user.id
    });

    logger.info(`Found ${result.matches.length} job matches for freelancer ${freelancerId} in ${Date.now() - startTime}ms`);
    res.json(result);

  } catch (error) {
    logger.error('Error in find-jobs:', error);
    res.status(500).json({ 
      error: 'Failed to find job matches',
      message: error.message 
    });
  }
});

/**
 * Batch matching for multiple job posts
 */
router.post('/batch-match', async (req, res) => {
  try {
    const { error, value } = batchMatchingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { jobPostIds, options } = value;
    const startTime = Date.now();

    logger.info(`Starting batch matching for ${jobPostIds.length} job posts`);

    let results;
    if (options.parallel) {
      // Parallel processing
      results = await Promise.allSettled(
        jobPostIds.map(jobPostId => 
          matchingEngine.findMatches(jobPostId, options)
        )
      );
    } else {
      // Sequential processing
      results = [];
      for (const jobPostId of jobPostIds) {
        try {
          const result = await matchingEngine.findMatches(jobPostId, options);
          results.push({ status: 'fulfilled', value: result });
        } catch (error) {
          results.push({ status: 'rejected', reason: error });
        }
      }
    }

    // Process results
    const successfulMatches = results
      .filter(result => result.status === 'fulfilled')
      .map((result, index) => ({
        jobPostId: jobPostIds[index],
        ...result.value
      }));

    const failedMatches = results
      .map((result, index) => ({ jobPostId: jobPostIds[index], result }))
      .filter(item => item.result.status === 'rejected')
      .map(item => ({
        jobPostId: item.jobPostId,
        error: item.result.reason.message
      }));

    const totalProcessingTime = Date.now() - startTime;
    const totalMatches = successfulMatches.reduce((sum, match) => sum + match.matches.length, 0);

    // Track analytics
    await analyticsService.trackMatching({
      type: 'batch_match',
      jobPostIds,
      totalMatches,
      successfulJobs: successfulMatches.length,
      failedJobs: failedMatches.length,
      processingTime: totalProcessingTime,
      userId: req.user.id
    });

    logger.info(`Batch matching completed: ${successfulMatches.length} successful, ${failedMatches.length} failed, ${totalMatches} total matches in ${totalProcessingTime}ms`);

    res.json({
      successful: successfulMatches,
      failed: failedMatches,
      summary: {
        totalJobs: jobPostIds.length,
        successfulJobs: successfulMatches.length,
        failedJobs: failedMatches.length,
        totalMatches,
        processingTime: totalProcessingTime,
        averageMatchesPerJob: successfulMatches.length > 0 ? totalMatches / successfulMatches.length : 0
      }
    });

  } catch (error) {
    logger.error('Error in batch-match:', error);
    res.status(500).json({ 
      error: 'Batch matching failed',
      message: error.message 
    });
  }
});

/**
 * Get optimized matches using ML optimization
 */
router.post('/optimized-matches', async (req, res) => {
  try {
    const { jobPostId, options = {} } = req.body;
    
    if (!jobPostId) {
      return res.status(400).json({ error: 'jobPostId is required' });
    }

    const startTime = Date.now();

    // Get base matches
    const baseMatches = await matchingEngine.findMatches(jobPostId, {
      ...options,
      limit: Math.min(options.limit * 2 || 100, 200) // Get more candidates for optimization
    });

    // Apply ML optimization
    const optimizedMatches = await matchingOptimizer.optimizeMatches(
      jobPostId,
      baseMatches.matches,
      options
    );

    const result = {
      matches: optimizedMatches.slice(0, options.limit || 50),
      metadata: {
        ...baseMatches.metadata,
        optimizationTime: Date.now() - startTime - baseMatches.metadata.processingTime,
        optimizationApplied: true,
        originalCount: baseMatches.matches.length,
        optimizedCount: optimizedMatches.length
      }
    };

    // Track analytics
    await analyticsService.trackMatching({
      type: 'optimized_matches',
      jobPostId,
      originalMatches: baseMatches.matches.length,
      optimizedMatches: optimizedMatches.length,
      processingTime: Date.now() - startTime,
      userId: req.user.id
    });

    logger.info(`Optimized matching completed for job post ${jobPostId}: ${baseMatches.matches.length} → ${optimizedMatches.length} matches`);
    res.json(result);

  } catch (error) {
    logger.error('Error in optimized-matches:', error);
    res.status(500).json({ 
      error: 'Optimized matching failed',
      message: error.message 
    });
  }
});

/**
 * Get matching statistics and insights
 */
router.get('/stats/:jobPostId', async (req, res) => {
  try {
    const { jobPostId } = req.params;
    
    // Get cached stats
    const cacheKey = `stats:${jobPostId}`;
    const cachedStats = await redisClient.get(cacheKey);
    
    if (cachedStats) {
      return res.json(JSON.parse(cachedStats));
    }

    // Generate fresh stats
    const stats = await analyticsService.getMatchingStats(jobPostId);
    
    // Cache for 1 hour
    await redisClient.setex(cacheKey, 3600, JSON.stringify(stats));
    
    res.json(stats);

  } catch (error) {
    logger.error('Error getting matching stats:', error);
    res.status(500).json({ 
      error: 'Failed to get matching statistics',
      message: error.message 
    });
  }
});

/**
 * Update matching algorithm weights
 */
router.post('/update-weights', async (req, res) => {
  try {
    const { weights } = req.body;
    
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({ error: 'Valid weights object is required' });
    }

    // Validate weights
    const validWeights = ['semantic', 'skills', 'experience', 'budget', 'availability', 'reputation', 'location', 'pastSuccess'];
    const invalidWeights = Object.keys(weights).filter(key => !validWeights.includes(key));
    
    if (invalidWeights.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid weight keys',
        invalidKeys: invalidWeights,
        validKeys: validWeights
      });
    }

    // Update weights
    matchingEngine.updateWeights(weights);
    
    // Clear cache to force recalculation
    await redisClient.flushdb();
    matchingEngine.clearCache();

    logger.info(`Matching weights updated by user ${req.user.id}:`, weights);
    
    res.json({ 
      message: 'Matching weights updated successfully',
      newWeights: matchingEngine.weights
    });

  } catch (error) {
    logger.error('Error updating matching weights:', error);
    res.status(500).json({ 
      error: 'Failed to update matching weights',
      message: error.message 
    });
  }
});

/**
 * Clear matching cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    const { type } = req.body;
    
    if (type === 'embeddings') {
      matchingEngine.clearCache();
    } else if (type === 'matches') {
      const keys = await redisClient.keys('matches:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } else if (type === 'all') {
      await redisClient.flushdb();
      matchingEngine.clearCache();
    } else {
      return res.status(400).json({ 
        error: 'Invalid cache type',
        validTypes: ['embeddings', 'matches', 'all']
      });
    }

    logger.info(`Cache cleared: ${type} by user ${req.user.id}`);
    
    res.json({ 
      message: `${type} cache cleared successfully`
    });

  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error.message 
    });
  }
});

/**
 * Health check for matching service
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        openai: 'unknown',
        redis: 'unknown',
        database: 'unknown'
      },
      cache: {
        embeddingCacheSize: matchingEngine.embeddingCache.size,
        redisCacheKeys: 0
      }
    };

    // Test OpenAI connection
    try {
      await matchingEngine.openai.models.list();
      health.services.openai = 'healthy';
    } catch (error) {
      health.services.openai = 'unhealthy';
      health.status = 'degraded';
    }

    // Test Redis connection
    try {
      await redisClient.ping();
      health.services.redis = 'healthy';
      health.cache.redisCacheKeys = await redisClient.dbsize();
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    res.json(health);

  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

module.exports = router;