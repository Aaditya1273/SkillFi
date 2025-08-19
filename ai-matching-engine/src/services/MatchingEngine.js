const OpenAI = require('openai');
const cosineSimilarity = require('cosine-similarity');
const natural = require('natural');
const compromise = require('compromise');
const { Matrix } = require('ml-matrix');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const FreelancerProfile = require('../models/FreelancerProfile');
const JobPost = require('../models/JobPost');
const MatchingResult = require('../models/MatchingResult');

class MatchingEngine {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Matching weights for different factors
    this.weights = {
      semantic: 0.35,        // Semantic similarity of descriptions
      skills: 0.25,          // Skill matching
      experience: 0.15,      // Experience level matching
      budget: 0.10,          // Budget compatibility
      availability: 0.05,    // Availability matching
      reputation: 0.05,      // Freelancer reputation
      location: 0.03,        // Location preference
      pastSuccess: 0.02      // Past collaboration success
    };
    
    // Cache for embeddings
    this.embeddingCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Main matching function - finds best freelancers for a job post
   */
  async findMatches(jobPostId, options = {}) {
    try {
      const startTime = Date.now();
      logger.info(`Starting matching process for job post: ${jobPostId}`);

      // Get job post details
      const jobPost = await JobPost.findById(jobPostId).populate('client');
      if (!jobPost) {
        throw new Error('Job post not found');
      }

      // Get active freelancers
      const freelancers = await this.getEligibleFreelancers(jobPost, options);
      logger.info(`Found ${freelancers.length} eligible freelancers`);

      if (freelancers.length === 0) {
        return { matches: [], metadata: { processingTime: Date.now() - startTime } };
      }

      // Generate embeddings for job post if not cached
      const jobEmbedding = await this.getJobEmbedding(jobPost);

      // Calculate matches for all freelancers
      const matches = await Promise.all(
        freelancers.map(freelancer => this.calculateMatch(jobPost, freelancer, jobEmbedding))
      );

      // Sort by match score and apply filters
      const sortedMatches = matches
        .filter(match => match.score >= (options.minScore || 0.3))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 50);

      // Save matching results
      await this.saveMatchingResults(jobPostId, sortedMatches);

      const processingTime = Date.now() - startTime;
      logger.info(`Matching completed in ${processingTime}ms. Found ${sortedMatches.length} matches`);

      return {
        matches: sortedMatches,
        metadata: {
          processingTime,
          totalFreelancers: freelancers.length,
          matchesFound: sortedMatches.length,
          averageScore: sortedMatches.reduce((sum, m) => sum + m.score, 0) / sortedMatches.length || 0
        }
      };

    } catch (error) {
      logger.error('Error in findMatches:', error);
      throw error;
    }
  }

  /**
   * Find suitable job posts for a freelancer
   */
  async findJobsForFreelancer(freelancerId, options = {}) {
    try {
      const startTime = Date.now();
      logger.info(`Finding jobs for freelancer: ${freelancerId}`);

      // Get freelancer profile
      const freelancer = await FreelancerProfile.findById(freelancerId);
      if (!freelancer) {
        throw new Error('Freelancer not found');
      }

      // Get active job posts
      const jobPosts = await this.getEligibleJobPosts(freelancer, options);
      logger.info(`Found ${jobPosts.length} eligible job posts`);

      if (jobPosts.length === 0) {
        return { matches: [], metadata: { processingTime: Date.now() - startTime } };
      }

      // Generate embedding for freelancer if not cached
      const freelancerEmbedding = await this.getFreelancerEmbedding(freelancer);

      // Calculate matches for all job posts
      const matches = await Promise.all(
        jobPosts.map(jobPost => this.calculateJobMatch(freelancer, jobPost, freelancerEmbedding))
      );

      // Sort and filter results
      const sortedMatches = matches
        .filter(match => match.score >= (options.minScore || 0.3))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 50);

      const processingTime = Date.now() - startTime;
      logger.info(`Job matching completed in ${processingTime}ms. Found ${sortedMatches.length} matches`);

      return {
        matches: sortedMatches,
        metadata: {
          processingTime,
          totalJobPosts: jobPosts.length,
          matchesFound: sortedMatches.length,
          averageScore: sortedMatches.reduce((sum, m) => sum + m.score, 0) / sortedMatches.length || 0
        }
      };

    } catch (error) {
      logger.error('Error in findJobsForFreelancer:', error);
      throw error;
    }
  }

  /**
   * Calculate match score between job post and freelancer
   */
  async calculateMatch(jobPost, freelancer, jobEmbedding) {
    try {
      const freelancerEmbedding = await this.getFreelancerEmbedding(freelancer);
      
      // Calculate individual scores
      const semanticScore = this.calculateSemanticSimilarity(jobEmbedding, freelancerEmbedding);
      const skillsScore = this.calculateSkillsMatch(jobPost.requiredSkills, freelancer.skills);
      const experienceScore = this.calculateExperienceMatch(jobPost.experienceLevel, freelancer.experienceLevel);
      const budgetScore = this.calculateBudgetCompatibility(jobPost.budget, freelancer.hourlyRate);
      const availabilityScore = this.calculateAvailabilityMatch(jobPost.timeline, freelancer.availability);
      const reputationScore = this.normalizeScore(freelancer.reputation || 0, 0, 5);
      const locationScore = this.calculateLocationMatch(jobPost.location, freelancer.location);
      const pastSuccessScore = await this.calculatePastSuccessScore(jobPost.client._id, freelancer._id);

      // Calculate weighted final score
      const finalScore = (
        semanticScore * this.weights.semantic +
        skillsScore * this.weights.skills +
        experienceScore * this.weights.experience +
        budgetScore * this.weights.budget +
        availabilityScore * this.weights.availability +
        reputationScore * this.weights.reputation +
        locationScore * this.weights.location +
        pastSuccessScore * this.weights.pastSuccess
      );

      return {
        freelancerId: freelancer._id,
        freelancer: {
          id: freelancer._id,
          name: freelancer.name,
          title: freelancer.title,
          avatar: freelancer.avatar,
          hourlyRate: freelancer.hourlyRate,
          reputation: freelancer.reputation,
          completedProjects: freelancer.completedProjects,
          skills: freelancer.skills.slice(0, 5), // Top 5 skills
          location: freelancer.location
        },
        score: Math.round(finalScore * 1000) / 1000, // Round to 3 decimal places
        breakdown: {
          semantic: Math.round(semanticScore * 1000) / 1000,
          skills: Math.round(skillsScore * 1000) / 1000,
          experience: Math.round(experienceScore * 1000) / 1000,
          budget: Math.round(budgetScore * 1000) / 1000,
          availability: Math.round(availabilityScore * 1000) / 1000,
          reputation: Math.round(reputationScore * 1000) / 1000,
          location: Math.round(locationScore * 1000) / 1000,
          pastSuccess: Math.round(pastSuccessScore * 1000) / 1000
        },
        reasons: this.generateMatchReasons(jobPost, freelancer, {
          semantic: semanticScore,
          skills: skillsScore,
          experience: experienceScore,
          budget: budgetScore
        })
      };

    } catch (error) {
      logger.error('Error calculating match:', error);
      return {
        freelancerId: freelancer._id,
        score: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate match score between freelancer and job post (reverse matching)
   */
  async calculateJobMatch(freelancer, jobPost, freelancerEmbedding) {
    try {
      const jobEmbedding = await this.getJobEmbedding(jobPost);
      
      // Use same calculation logic but from freelancer perspective
      const match = await this.calculateMatch(jobPost, freelancer, jobEmbedding);
      
      return {
        jobPostId: jobPost._id,
        jobPost: {
          id: jobPost._id,
          title: jobPost.title,
          description: jobPost.description.substring(0, 200) + '...',
          budget: jobPost.budget,
          timeline: jobPost.timeline,
          requiredSkills: jobPost.requiredSkills.slice(0, 5),
          client: {
            name: jobPost.client.name,
            reputation: jobPost.client.reputation
          }
        },
        score: match.score,
        breakdown: match.breakdown,
        reasons: this.generateJobMatchReasons(freelancer, jobPost, match.breakdown)
      };

    } catch (error) {
      logger.error('Error calculating job match:', error);
      return {
        jobPostId: jobPost._id,
        score: 0,
        error: error.message
      };
    }
  }

  /**
   * Get or generate embedding for job post
   */
  async getJobEmbedding(jobPost) {
    const cacheKey = `job_embedding_${jobPost._id}`;
    
    // Check cache first
    if (this.embeddingCache.has(cacheKey)) {
      const cached = this.embeddingCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.embedding;
      }
    }

    // Check Redis cache
    const redisKey = `embedding:job:${jobPost._id}`;
    const cachedEmbedding = await redisClient.get(redisKey);
    if (cachedEmbedding) {
      const embedding = JSON.parse(cachedEmbedding);
      this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
      return embedding;
    }

    // Generate new embedding
    const text = this.prepareJobText(jobPost);
    const embedding = await this.generateEmbedding(text);
    
    // Cache the result
    this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
    await redisClient.setex(redisKey, 86400, JSON.stringify(embedding)); // 24 hour cache
    
    return embedding;
  }

  /**
   * Get or generate embedding for freelancer
   */
  async getFreelancerEmbedding(freelancer) {
    const cacheKey = `freelancer_embedding_${freelancer._id}`;
    
    // Check cache first
    if (this.embeddingCache.has(cacheKey)) {
      const cached = this.embeddingCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.embedding;
      }
    }

    // Check Redis cache
    const redisKey = `embedding:freelancer:${freelancer._id}`;
    const cachedEmbedding = await redisClient.get(redisKey);
    if (cachedEmbedding) {
      const embedding = JSON.parse(cachedEmbedding);
      this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
      return embedding;
    }

    // Generate new embedding
    const text = this.prepareFreelancerText(freelancer);
    const embedding = await this.generateEmbedding(text);
    
    // Cache the result
    this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
    await redisClient.setex(redisKey, 86400, JSON.stringify(embedding));
    
    return embedding;
  }

  /**
   * Generate embedding using OpenAI API
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Prepare job post text for embedding
   */
  prepareJobText(jobPost) {
    const skillsText = jobPost.requiredSkills.join(', ');
    const experienceText = jobPost.experienceLevel || 'any level';
    const budgetText = jobPost.budget ? `Budget: $${jobPost.budget}` : '';
    
    return `${jobPost.title}. ${jobPost.description}. Required skills: ${skillsText}. Experience level: ${experienceText}. ${budgetText}`.trim();
  }

  /**
   * Prepare freelancer profile text for embedding
   */
  prepareFreelancerText(freelancer) {
    const skillsText = freelancer.skills.join(', ');
    const experienceText = freelancer.experienceLevel || 'experienced';
    const bioText = freelancer.bio || '';
    
    return `${freelancer.title}. ${bioText}. Skills: ${skillsText}. Experience: ${experienceText}. Hourly rate: $${freelancer.hourlyRate || 'negotiable'}`.trim();
  }

  /**
   * Calculate semantic similarity using cosine similarity
   */
  calculateSemanticSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0;
    
    try {
      const similarity = cosineSimilarity(embedding1, embedding2);
      return Math.max(0, Math.min(1, similarity)); // Clamp between 0 and 1
    } catch (error) {
      logger.error('Error calculating semantic similarity:', error);
      return 0;
    }
  }

  /**
   * Calculate skills matching score
   */
  calculateSkillsMatch(requiredSkills, freelancerSkills) {
    if (!requiredSkills || !freelancerSkills || requiredSkills.length === 0) return 0;
    
    const required = requiredSkills.map(s => s.toLowerCase());
    const available = freelancerSkills.map(s => s.name ? s.name.toLowerCase() : s.toLowerCase());
    
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const requiredSkill of required) {
      if (available.includes(requiredSkill)) {
        exactMatches++;
      } else {
        // Check for partial matches using string similarity
        const partialMatch = available.some(availableSkill => {
          const similarity = natural.JaroWinklerDistance(requiredSkill, availableSkill);
          return similarity > 0.8; // 80% similarity threshold
        });
        if (partialMatch) partialMatches++;
      }
    }
    
    const exactScore = exactMatches / required.length;
    const partialScore = (partialMatches / required.length) * 0.5; // Partial matches worth 50%
    
    return Math.min(1, exactScore + partialScore);
  }

  /**
   * Calculate experience level matching
   */
  calculateExperienceMatch(requiredLevel, freelancerLevel) {
    const levels = {
      'entry': 1,
      'junior': 2,
      'mid': 3,
      'senior': 4,
      'expert': 5
    };
    
    const required = levels[requiredLevel?.toLowerCase()] || 3;
    const available = levels[freelancerLevel?.toLowerCase()] || 3;
    
    if (available >= required) {
      return 1; // Perfect match or overqualified
    } else {
      // Penalize underqualification
      const gap = required - available;
      return Math.max(0, 1 - (gap * 0.3));
    }
  }

  /**
   * Calculate budget compatibility
   */
  calculateBudgetCompatibility(projectBudget, hourlyRate) {
    if (!projectBudget || !hourlyRate) return 0.5; // Neutral if no budget info
    
    // Estimate project hours (rough approximation)
    const estimatedHours = projectBudget / hourlyRate;
    
    if (estimatedHours >= 10 && estimatedHours <= 200) {
      return 1; // Good budget match
    } else if (estimatedHours >= 5 && estimatedHours <= 300) {
      return 0.7; // Acceptable match
    } else {
      return 0.3; // Poor budget match
    }
  }

  /**
   * Calculate availability matching
   */
  calculateAvailabilityMatch(projectTimeline, freelancerAvailability) {
    if (!projectTimeline || !freelancerAvailability) return 0.5;
    
    // Simple availability matching logic
    // This could be enhanced with more sophisticated scheduling
    const timelineWeeks = this.parseTimelineToWeeks(projectTimeline);
    const availableWeeks = freelancerAvailability.hoursPerWeek ? 
      Math.floor(freelancerAvailability.hoursPerWeek / 10) : 4; // Assume 10 hours per week minimum
    
    if (availableWeeks >= timelineWeeks) {
      return 1;
    } else {
      return availableWeeks / timelineWeeks;
    }
  }

  /**
   * Calculate location matching score
   */
  calculateLocationMatch(jobLocation, freelancerLocation) {
    if (!jobLocation || !freelancerLocation) return 0.5;
    
    // If both are remote, perfect match
    if (jobLocation.toLowerCase().includes('remote') && 
        freelancerLocation.toLowerCase().includes('remote')) {
      return 1;
    }
    
    // If job is remote but freelancer isn't specified as remote
    if (jobLocation.toLowerCase().includes('remote')) {
      return 0.8;
    }
    
    // Simple location matching (could be enhanced with geolocation)
    const jobLoc = jobLocation.toLowerCase();
    const freelancerLoc = freelancerLocation.toLowerCase();
    
    if (jobLoc === freelancerLoc) return 1;
    if (jobLoc.includes(freelancerLoc) || freelancerLoc.includes(jobLoc)) return 0.7;
    
    return 0.3;
  }

  /**
   * Calculate past success score between client and freelancer
   */
  async calculatePastSuccessScore(clientId, freelancerId) {
    try {
      // This would query past project collaborations
      // For now, return neutral score
      return 0.5;
    } catch (error) {
      logger.error('Error calculating past success score:', error);
      return 0.5;
    }
  }

  /**
   * Get eligible freelancers for a job post
   */
  async getEligibleFreelancers(jobPost, options = {}) {
    const query = {
      isActive: true,
      isAvailable: true
    };

    // Add filters based on job requirements
    if (jobPost.requiredSkills && jobPost.requiredSkills.length > 0) {
      query['skills.name'] = { $in: jobPost.requiredSkills };
    }

    if (jobPost.budget && options.budgetFilter) {
      const maxHourlyRate = jobPost.budget / 10; // Assume minimum 10 hours
      query.hourlyRate = { $lte: maxHourlyRate };
    }

    return await FreelancerProfile.find(query)
      .limit(options.maxFreelancers || 1000)
      .lean();
  }

  /**
   * Get eligible job posts for a freelancer
   */
  async getEligibleJobPosts(freelancer, options = {}) {
    const query = {
      status: 'open',
      isActive: true
    };

    // Add filters based on freelancer preferences
    if (freelancer.skills && freelancer.skills.length > 0) {
      const skillNames = freelancer.skills.map(s => s.name || s);
      query.requiredSkills = { $in: skillNames };
    }

    if (freelancer.hourlyRate && options.budgetFilter) {
      const minBudget = freelancer.hourlyRate * 10; // Assume minimum 10 hours
      query.budget = { $gte: minBudget };
    }

    return await JobPost.find(query)
      .populate('client', 'name reputation')
      .limit(options.maxJobPosts || 1000)
      .lean();
  }

  /**
   * Generate match reasons for display
   */
  generateMatchReasons(jobPost, freelancer, scores) {
    const reasons = [];
    
    if (scores.skills > 0.8) {
      reasons.push(`Strong skill match (${Math.round(scores.skills * 100)}%)`);
    }
    
    if (scores.semantic > 0.7) {
      reasons.push('Excellent semantic match for project requirements');
    }
    
    if (scores.experience > 0.8) {
      reasons.push('Experience level aligns well with project needs');
    }
    
    if (scores.budget > 0.7) {
      reasons.push('Budget expectations are compatible');
    }
    
    if (freelancer.reputation > 4.5) {
      reasons.push(`Highly rated freelancer (${freelancer.reputation}/5)`);
    }
    
    if (freelancer.completedProjects > 50) {
      reasons.push(`Experienced with ${freelancer.completedProjects}+ completed projects`);
    }
    
    return reasons.slice(0, 3); // Return top 3 reasons
  }

  /**
   * Generate job match reasons for freelancers
   */
  generateJobMatchReasons(freelancer, jobPost, scores) {
    const reasons = [];
    
    if (scores.skills > 0.8) {
      reasons.push('Your skills are a perfect match for this project');
    }
    
    if (scores.semantic > 0.7) {
      reasons.push('Project description aligns with your expertise');
    }
    
    if (scores.budget > 0.7) {
      reasons.push('Budget matches your rate expectations');
    }
    
    if (jobPost.client.reputation > 4.5) {
      reasons.push(`Highly rated client (${jobPost.client.reputation}/5)`);
    }
    
    return reasons.slice(0, 3);
  }

  /**
   * Save matching results to database
   */
  async saveMatchingResults(jobPostId, matches) {
    try {
      const matchingResult = new MatchingResult({
        jobPostId,
        matches: matches.map(match => ({
          freelancerId: match.freelancerId,
          score: match.score,
          breakdown: match.breakdown,
          reasons: match.reasons
        })),
        generatedAt: new Date(),
        algorithm: 'semantic_v1',
        totalMatches: matches.length
      });

      await matchingResult.save();
      logger.info(`Saved matching results for job post ${jobPostId}`);
    } catch (error) {
      logger.error('Error saving matching results:', error);
    }
  }

  /**
   * Utility functions
   */
  normalizeScore(value, min, max) {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  parseTimelineToWeeks(timeline) {
    if (!timeline) return 4; // Default 4 weeks
    
    const timelineStr = timeline.toLowerCase();
    if (timelineStr.includes('week')) {
      const weeks = parseInt(timelineStr.match(/\d+/)?.[0]) || 4;
      return weeks;
    } else if (timelineStr.includes('month')) {
      const months = parseInt(timelineStr.match(/\d+/)?.[0]) || 1;
      return months * 4;
    } else if (timelineStr.includes('day')) {
      const days = parseInt(timelineStr.match(/\d+/)?.[0]) || 28;
      return Math.ceil(days / 7);
    }
    
    return 4; // Default fallback
  }

  /**
   * Update matching weights based on performance feedback
   */
  updateWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
    logger.info('Updated matching weights:', this.weights);
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    this.embeddingCache.clear();
    logger.info('Embedding cache cleared');
  }
}

module.exports = MatchingEngine;