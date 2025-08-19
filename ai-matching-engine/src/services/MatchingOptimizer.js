const { Matrix } = require('ml-matrix');
const KMeans = require('ml-kmeans');
const logger = require('../utils/logger');
const MatchingResult = require('../models/MatchingResult');
const UserFeedback = require('../models/UserFeedback');

/**
 * Advanced matching optimizer using machine learning techniques
 */
class MatchingOptimizer {
  constructor() {
    this.learningRate = 0.01;
    this.regularization = 0.001;
    this.feedbackWeight = 0.3;
    this.diversityWeight = 0.2;
    this.performanceHistory = new Map();
    
    // Feature weights learned from historical data
    this.learnedWeights = {
      semantic: 0.35,
      skills: 0.25,
      experience: 0.15,
      budget: 0.10,
      availability: 0.05,
      reputation: 0.05,
      location: 0.03,
      pastSuccess: 0.02
    };
  }

  /**
   * Optimize matches using ML techniques and historical feedback
   */
  async optimizeMatches(jobPostId, matches, options = {}) {
    try {
      logger.info(`Optimizing ${matches.length} matches for job post ${jobPostId}`);

      if (matches.length === 0) return matches;

      // Apply different optimization strategies
      let optimizedMatches = [...matches];

      // 1. Feedback-based reranking
      optimizedMatches = await this.applyFeedbackReranking(jobPostId, optimizedMatches);

      // 2. Diversity optimization
      if (options.diversityOptimization !== false) {
        optimizedMatches = this.applyDiversityOptimization(optimizedMatches, options);
      }

      // 3. Performance-based adjustment
      optimizedMatches = await this.applyPerformanceAdjustment(optimizedMatches);

      // 4. Collaborative filtering
      if (options.collaborativeFiltering !== false) {
        optimizedMatches = await this.applyCollaborativeFiltering(jobPostId, optimizedMatches);
      }

      // 5. Temporal optimization
      optimizedMatches = this.applyTemporalOptimization(optimizedMatches);

      // 6. Final ranking with learned weights
      optimizedMatches = this.applyLearnedWeights(optimizedMatches);

      logger.info(`Optimization completed: ${matches.length} → ${optimizedMatches.length} matches`);
      return optimizedMatches;

    } catch (error) {
      logger.error('Error in optimizeMatches:', error);
      return matches; // Return original matches if optimization fails
    }
  }

  /**
   * Apply feedback-based reranking using historical user interactions
   */
  async applyFeedbackReranking(jobPostId, matches) {
    try {
      // Get historical feedback for similar job posts
      const feedback = await this.getHistoricalFeedback(jobPostId);
      
      if (feedback.length === 0) return matches;

      // Create feedback model
      const feedbackModel = this.buildFeedbackModel(feedback);

      // Adjust scores based on feedback
      const adjustedMatches = matches.map(match => {
        const feedbackScore = this.calculateFeedbackScore(match, feedbackModel);
        const adjustedScore = match.score * (1 - this.feedbackWeight) + feedbackScore * this.feedbackWeight;
        
        return {
          ...match,
          score: adjustedScore,
          originalScore: match.score,
          feedbackAdjustment: feedbackScore - match.score
        };
      });

      return adjustedMatches.sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error in feedback reranking:', error);
      return matches;
    }
  }

  /**
   * Apply diversity optimization to ensure varied results
   */
  applyDiversityOptimization(matches, options = {}) {
    try {
      const diversityFactor = options.diversityFactor || 0.3;
      const maxSimilarSkills = options.maxSimilarSkills || 3;

      if (matches.length <= 5) return matches; // Skip for small result sets

      const diversifiedMatches = [];
      const usedSkillCombinations = new Set();

      // Sort by score first
      const sortedMatches = [...matches].sort((a, b) => b.score - a.score);

      for (const match of sortedMatches) {
        const skillSignature = this.getSkillSignature(match.freelancer.skills);
        
        // Check if we already have similar skill combinations
        const similarCount = Array.from(usedSkillCombinations)
          .filter(signature => this.calculateSkillSimilarity(skillSignature, signature) > 0.7)
          .length;

        if (similarCount < maxSimilarSkills || diversifiedMatches.length < 10) {
          // Apply diversity penalty for similar matches
          const diversityPenalty = similarCount * diversityFactor * 0.1;
          match.score = Math.max(0, match.score - diversityPenalty);
          match.diversityPenalty = diversityPenalty;
          
          diversifiedMatches.push(match);
          usedSkillCombinations.add(skillSignature);
        }
      }

      return diversifiedMatches.sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error in diversity optimization:', error);
      return matches;
    }
  }

  /**
   * Apply performance-based adjustments using historical success rates
   */
  async applyPerformanceAdjustment(matches) {
    try {
      const adjustedMatches = await Promise.all(matches.map(async (match) => {
        const performanceScore = await this.getFreelancerPerformanceScore(match.freelancerId);
        const performanceAdjustment = (performanceScore - 0.5) * 0.1; // ±5% adjustment
        
        return {
          ...match,
          score: Math.max(0, Math.min(1, match.score + performanceAdjustment)),
          performanceAdjustment
        };
      }));

      return adjustedMatches.sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error in performance adjustment:', error);
      return matches;
    }
  }

  /**
   * Apply collaborative filtering based on similar clients' choices
   */
  async applyCollaborativeFiltering(jobPostId, matches) {
    try {
      // Find similar clients and their successful hires
      const similarClientChoices = await this.getSimilarClientChoices(jobPostId);
      
      if (similarClientChoices.length === 0) return matches;

      // Create collaborative filtering model
      const cfModel = this.buildCollaborativeFilteringModel(similarClientChoices);

      // Adjust scores based on collaborative filtering
      const cfAdjustedMatches = matches.map(match => {
        const cfScore = this.calculateCollaborativeScore(match.freelancerId, cfModel);
        const cfWeight = 0.15; // 15% weight for collaborative filtering
        const adjustedScore = match.score * (1 - cfWeight) + cfScore * cfWeight;
        
        return {
          ...match,
          score: adjustedScore,
          collaborativeScore: cfScore
        };
      });

      return cfAdjustedMatches.sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error in collaborative filtering:', error);
      return matches;
    }
  }

  /**
   * Apply temporal optimization considering time-based factors
   */
  applyTemporalOptimization(matches) {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

      return matches.map(match => {
        let temporalBoost = 0;

        // Boost freelancers who are likely to be online
        if (match.freelancer.timezone) {
          const freelancerHour = this.adjustForTimezone(currentHour, match.freelancer.timezone);
          if (freelancerHour >= 9 && freelancerHour <= 17) { // Business hours
            temporalBoost += 0.02;
          }
        }

        // Boost freelancers who are typically active on current day
        if (match.freelancer.activeHours && match.freelancer.activeHours[currentDay]) {
          temporalBoost += 0.01;
        }

        // Boost recently active freelancers
        if (match.freelancer.lastSeen) {
          const hoursSinceLastSeen = (now - new Date(match.freelancer.lastSeen)) / (1000 * 60 * 60);
          if (hoursSinceLastSeen < 24) {
            temporalBoost += 0.03 * (1 - hoursSinceLastSeen / 24);
          }
        }

        return {
          ...match,
          score: Math.min(1, match.score + temporalBoost),
          temporalBoost
        };
      }).sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error in temporal optimization:', error);
      return matches;
    }
  }

  /**
   * Apply learned weights from historical performance
   */
  applyLearnedWeights(matches) {
    try {
      return matches.map(match => {
        if (!match.breakdown) return match;

        // Recalculate score using learned weights
        const learnedScore = Object.keys(this.learnedWeights).reduce((sum, key) => {
          const value = match.breakdown[key] || 0;
          const weight = this.learnedWeights[key] || 0;
          return sum + (value * weight);
        }, 0);

        // Blend with original score
        const blendWeight = 0.3; // 30% learned weights, 70% original
        const finalScore = match.score * (1 - blendWeight) + learnedScore * blendWeight;

        return {
          ...match,
          score: finalScore,
          learnedScore,
          originalScore: match.score
        };
      }).sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error applying learned weights:', error);
      return matches;
    }
  }

  /**
   * Learn from user feedback to improve future matches
   */
  async learnFromFeedback(jobPostId, freelancerId, feedback) {
    try {
      // Store feedback
      const userFeedback = new UserFeedback({
        jobPostId,
        freelancerId,
        rating: feedback.rating,
        hired: feedback.hired,
        reasons: feedback.reasons,
        timestamp: new Date()
      });

      await userFeedback.save();

      // Update learned weights based on feedback
      await this.updateLearnedWeights(feedback);

      logger.info(`Learned from feedback for job ${jobPostId}, freelancer ${freelancerId}`);

    } catch (error) {
      logger.error('Error learning from feedback:', error);
    }
  }

  /**
   * Update learned weights using gradient descent
   */
  async updateLearnedWeights(feedback) {
    try {
      if (!feedback.breakdown) return;

      const target = feedback.hired ? 1 : 0;
      const predicted = feedback.originalScore || 0.5;
      const error = target - predicted;

      // Update weights using gradient descent
      Object.keys(this.learnedWeights).forEach(key => {
        if (feedback.breakdown[key] !== undefined) {
          const gradient = error * feedback.breakdown[key];
          this.learnedWeights[key] += this.learningRate * gradient;
          
          // Apply regularization
          this.learnedWeights[key] *= (1 - this.regularization);
        }
      });

      // Normalize weights to sum to 1
      const totalWeight = Object.values(this.learnedWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(this.learnedWeights).forEach(key => {
        this.learnedWeights[key] /= totalWeight;
      });

      logger.debug('Updated learned weights:', this.learnedWeights);

    } catch (error) {
      logger.error('Error updating learned weights:', error);
    }
  }

  /**
   * Cluster matches to identify patterns
   */
  clusterMatches(matches, numClusters = 3) {
    try {
      if (matches.length < numClusters) return matches;

      // Extract features for clustering
      const features = matches.map(match => [
        match.breakdown.semantic || 0,
        match.breakdown.skills || 0,
        match.breakdown.experience || 0,
        match.breakdown.budget || 0,
        match.freelancer.reputation || 0,
        match.freelancer.completedProjects || 0
      ]);

      const data = new Matrix(features);
      const kmeans = new KMeans(data, numClusters);

      // Add cluster information to matches
      return matches.map((match, index) => ({
        ...match,
        cluster: kmeans.clusters[index],
        clusterCenter: kmeans.centroids.getRow(kmeans.clusters[index])
      }));

    } catch (error) {
      logger.error('Error clustering matches:', error);
      return matches;
    }
  }

  /**
   * Helper methods
   */
  async getHistoricalFeedback(jobPostId) {
    try {
      // Get feedback for similar job posts
      return await UserFeedback.find({
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }).limit(1000);
    } catch (error) {
      logger.error('Error getting historical feedback:', error);
      return [];
    }
  }

  buildFeedbackModel(feedback) {
    const model = {
      positiveFeatures: {},
      negativeFeatures: {},
      totalPositive: 0,
      totalNegative: 0
    };

    feedback.forEach(fb => {
      const features = this.extractFeedbackFeatures(fb);
      const target = fb.hired ? 'positiveFeatures' : 'negativeFeatures';
      const count = fb.hired ? 'totalPositive' : 'totalNegative';

      features.forEach(feature => {
        model[target][feature] = (model[target][feature] || 0) + 1;
      });
      model[count]++;
    });

    return model;
  }

  calculateFeedbackScore(match, feedbackModel) {
    const features = this.extractMatchFeatures(match);
    let score = 0.5; // Neutral starting point

    features.forEach(feature => {
      const positive = feedbackModel.positiveFeatures[feature] || 0;
      const negative = feedbackModel.negativeFeatures[feature] || 0;
      const total = positive + negative;

      if (total > 0) {
        const featureScore = positive / total;
        score += (featureScore - 0.5) * 0.1; // Small adjustment per feature
      }
    });

    return Math.max(0, Math.min(1, score));
  }

  extractFeedbackFeatures(feedback) {
    const features = [];
    
    if (feedback.freelancerId) {
      features.push(`freelancer:${feedback.freelancerId}`);
    }
    
    if (feedback.reasons) {
      feedback.reasons.forEach(reason => {
        features.push(`reason:${reason}`);
      });
    }

    return features;
  }

  extractMatchFeatures(match) {
    const features = [];
    
    features.push(`freelancer:${match.freelancerId}`);
    
    if (match.freelancer.skills) {
      match.freelancer.skills.forEach(skill => {
        features.push(`skill:${skill}`);
      });
    }
    
    if (match.freelancer.location) {
      features.push(`location:${match.freelancer.location}`);
    }

    return features;
  }

  getSkillSignature(skills) {
    return skills.sort().join(',').toLowerCase();
  }

  calculateSkillSimilarity(signature1, signature2) {
    const skills1 = signature1.split(',');
    const skills2 = signature2.split(',');
    const intersection = skills1.filter(skill => skills2.includes(skill));
    const union = [...new Set([...skills1, ...skills2])];
    
    return intersection.length / union.length;
  }

  async getFreelancerPerformanceScore(freelancerId) {
    try {
      // Calculate performance score based on historical data
      // This would query actual performance metrics
      return 0.7; // Placeholder
    } catch (error) {
      logger.error('Error getting performance score:', error);
      return 0.5; // Neutral score
    }
  }

  async getSimilarClientChoices(jobPostId) {
    try {
      // Find similar clients and their successful hires
      // This would implement collaborative filtering logic
      return [];
    } catch (error) {
      logger.error('Error getting similar client choices:', error);
      return [];
    }
  }

  buildCollaborativeFilteringModel(choices) {
    // Build collaborative filtering model
    return {
      freelancerScores: {},
      totalChoices: choices.length
    };
  }

  calculateCollaborativeScore(freelancerId, model) {
    return model.freelancerScores[freelancerId] || 0.5;
  }

  adjustForTimezone(hour, timezone) {
    // Simple timezone adjustment (would need proper timezone library in production)
    const timezoneOffsets = {
      'UTC': 0,
      'EST': -5,
      'PST': -8,
      'GMT': 0
    };
    
    const offset = timezoneOffsets[timezone] || 0;
    return (hour + offset + 24) % 24;
  }

  /**
   * Get optimization performance metrics
   */
  getOptimizationMetrics() {
    return {
      learnedWeights: this.learnedWeights,
      learningRate: this.learningRate,
      regularization: this.regularization,
      feedbackWeight: this.feedbackWeight,
      diversityWeight: this.diversityWeight,
      performanceHistorySize: this.performanceHistory.size
    };
  }

  /**
   * Reset learned weights to default values
   */
  resetLearnedWeights() {
    this.learnedWeights = {
      semantic: 0.35,
      skills: 0.25,
      experience: 0.15,
      budget: 0.10,
      availability: 0.05,
      reputation: 0.05,
      location: 0.03,
      pastSuccess: 0.02
    };
    
    logger.info('Learned weights reset to default values');
  }
}

module.exports = MatchingOptimizer;