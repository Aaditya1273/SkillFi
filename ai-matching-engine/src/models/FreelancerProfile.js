const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'intermediate'
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  verified: {
    type: Boolean,
    default: false
  },
  endorsements: {
    type: Number,
    default: 0
  }
});

const portfolioItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  technologies: [String],
  url: String,
  imageUrl: String,
  completedAt: Date,
  clientFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String
  }
});

const availabilitySchema = new mongoose.Schema({
  hoursPerWeek: {
    type: Number,
    min: 1,
    max: 168
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  preferredWorkingHours: {
    start: String, // e.g., "09:00"
    end: String    // e.g., "17:00"
  },
  availableDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  startDate: Date,
  isAvailable: {
    type: Boolean,
    default: true
  }
});

const freelancerProfileSchema = new mongoose.Schema({
  // Basic Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  bio: {
    type: String,
    required: true,
    maxlength: 2000
  },
  avatar: {
    type: String,
    default: null
  },
  
  // Professional Information
  skills: [skillSchema],
  experienceLevel: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'expert'],
    required: true
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  hourlyRate: {
    type: Number,
    min: 1,
    max: 10000
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  
  // Location and Availability
  location: {
    country: String,
    city: String,
    timezone: String,
    isRemoteOnly: {
      type: Boolean,
      default: true
    }
  },
  availability: availabilitySchema,
  
  // Portfolio and Work History
  portfolio: [portfolioItemSchema],
  completedProjects: {
    type: Number,
    default: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  
  // Reputation and Reviews
  reputation: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  reviewBreakdown: {
    5: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    1: { type: Number, default: 0 }
  },
  
  // Categories and Specializations
  categories: [{
    type: String,
    enum: [
      'web-development',
      'mobile-development',
      'blockchain',
      'ai-ml',
      'data-science',
      'design',
      'marketing',
      'writing',
      'consulting',
      'other'
    ]
  }],
  specializations: [String],
  
  // Preferences
  preferences: {
    projectTypes: [{
      type: String,
      enum: ['short-term', 'long-term', 'fixed-price', 'hourly', 'retainer']
    }],
    clientTypes: [{
      type: String,
      enum: ['startup', 'enterprise', 'agency', 'individual', 'non-profit']
    }],
    budgetRange: {
      min: Number,
      max: Number
    },
    communicationStyle: {
      type: String,
      enum: ['formal', 'casual', 'collaborative', 'independent']
    }
  },
  
  // Verification and Credentials
  verifications: {
    email: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Boolean,
      default: false
    },
    identity: {
      type: Boolean,
      default: false
    },
    skills: [{
      skill: String,
      verifiedBy: String,
      verifiedAt: Date
    }]
  },
  
  // Activity and Engagement
  activityMetrics: {
    responseTime: {
      type: Number, // in hours
      default: 24
    },
    responseRate: {
      type: Number, // percentage
      default: 100
    },
    onTimeDelivery: {
      type: Number, // percentage
      default: 100
    },
    repeatClientRate: {
      type: Number, // percentage
      default: 0
    }
  },
  
  // AI and Matching Data
  embeddingVector: [Number], // Cached embedding for faster matching
  embeddingUpdatedAt: Date,
  matchingPreferences: {
    semanticWeight: {
      type: Number,
      default: 0.35
    },
    skillsWeight: {
      type: Number,
      default: 0.25
    },
    budgetWeight: {
      type: Number,
      default: 0.15
    }
  },
  
  // Status and Timestamps
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  profileCompleteness: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
freelancerProfileSchema.index({ userId: 1 });
freelancerProfileSchema.index({ 'skills.name': 1 });
freelancerProfileSchema.index({ categories: 1 });
freelancerProfileSchema.index({ hourlyRate: 1 });
freelancerProfileSchema.index({ reputation: -1 });
freelancerProfileSchema.index({ isActive: 1, isAvailable: 1 });
freelancerProfileSchema.index({ 'location.country': 1 });
freelancerProfileSchema.index({ experienceLevel: 1 });
freelancerProfileSchema.index({ completedProjects: -1 });
freelancerProfileSchema.index({ lastSeen: -1 });

// Compound indexes for common queries
freelancerProfileSchema.index({ 
  isActive: 1, 
  isAvailable: 1, 
  'skills.name': 1, 
  hourlyRate: 1 
});

freelancerProfileSchema.index({ 
  categories: 1, 
  reputation: -1, 
  completedProjects: -1 
});

// Virtual for average rating calculation
freelancerProfileSchema.virtual('averageRating').get(function() {
  if (this.totalReviews === 0) return 0;
  
  const totalPoints = Object.keys(this.reviewBreakdown).reduce((sum, rating) => {
    return sum + (parseInt(rating) * this.reviewBreakdown[rating]);
  }, 0);
  
  return totalPoints / this.totalReviews;
});

// Virtual for skill names array (for easier querying)
freelancerProfileSchema.virtual('skillNames').get(function() {
  return this.skills.map(skill => skill.name);
});

// Virtual for full location string
freelancerProfileSchema.virtual('fullLocation').get(function() {
  if (!this.location) return 'Remote';
  
  const parts = [];
  if (this.location.city) parts.push(this.location.city);
  if (this.location.country) parts.push(this.location.country);
  
  return parts.length > 0 ? parts.join(', ') : 'Remote';
});

// Pre-save middleware to calculate profile completeness
freelancerProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.profileCompleteness = this.calculateProfileCompleteness();
  next();
});

// Method to calculate profile completeness percentage
freelancerProfileSchema.methods.calculateProfileCompleteness = function() {
  let score = 0;
  const maxScore = 100;
  
  // Basic information (30 points)
  if (this.name) score += 5;
  if (this.title) score += 5;
  if (this.bio && this.bio.length >= 100) score += 10;
  if (this.avatar) score += 5;
  if (this.hourlyRate) score += 5;
  
  // Skills (20 points)
  if (this.skills.length >= 3) score += 10;
  if (this.skills.length >= 5) score += 5;
  if (this.skills.some(skill => skill.verified)) score += 5;
  
  // Portfolio (20 points)
  if (this.portfolio.length >= 1) score += 10;
  if (this.portfolio.length >= 3) score += 5;
  if (this.portfolio.some(item => item.url)) score += 5;
  
  // Experience and credentials (15 points)
  if (this.experienceLevel) score += 5;
  if (this.yearsOfExperience) score += 5;
  if (this.categories.length > 0) score += 5;
  
  // Availability (10 points)
  if (this.availability && this.availability.hoursPerWeek) score += 5;
  if (this.location && this.location.timezone) score += 5;
  
  // Verifications (5 points)
  if (this.verifications.email) score += 2;
  if (this.verifications.phone) score += 2;
  if (this.verifications.identity) score += 1;
  
  return Math.min(score, maxScore);
};

// Method to update reputation based on new review
freelancerProfileSchema.methods.updateReputation = function(rating) {
  this.reviewBreakdown[rating] = (this.reviewBreakdown[rating] || 0) + 1;
  this.totalReviews += 1;
  
  // Recalculate average reputation
  const totalPoints = Object.keys(this.reviewBreakdown).reduce((sum, r) => {
    return sum + (parseInt(r) * this.reviewBreakdown[r]);
  }, 0);
  
  this.reputation = totalPoints / this.totalReviews;
  return this.reputation;
};

// Method to add skill
freelancerProfileSchema.methods.addSkill = function(skillData) {
  const existingSkill = this.skills.find(skill => 
    skill.name.toLowerCase() === skillData.name.toLowerCase()
  );
  
  if (existingSkill) {
    // Update existing skill
    Object.assign(existingSkill, skillData);
  } else {
    // Add new skill
    this.skills.push(skillData);
  }
  
  return this.save();
};

// Method to remove skill
freelancerProfileSchema.methods.removeSkill = function(skillName) {
  this.skills = this.skills.filter(skill => 
    skill.name.toLowerCase() !== skillName.toLowerCase()
  );
  
  return this.save();
};

// Method to update availability
freelancerProfileSchema.methods.updateAvailability = function(availabilityData) {
  this.availability = { ...this.availability, ...availabilityData };
  this.isAvailable = availabilityData.isAvailable !== undefined ? 
    availabilityData.isAvailable : this.isAvailable;
  
  return this.save();
};

// Static method to find freelancers by skills
freelancerProfileSchema.statics.findBySkills = function(skills, options = {}) {
  const query = {
    isActive: true,
    'skills.name': { $in: skills }
  };
  
  if (options.minRating) {
    query.reputation = { $gte: options.minRating };
  }
  
  if (options.maxHourlyRate) {
    query.hourlyRate = { $lte: options.maxHourlyRate };
  }
  
  if (options.experienceLevel) {
    query.experienceLevel = options.experienceLevel;
  }
  
  return this.find(query)
    .sort({ reputation: -1, completedProjects: -1 })
    .limit(options.limit || 50);
};

// Static method to find available freelancers
freelancerProfileSchema.statics.findAvailable = function(options = {}) {
  const query = {
    isActive: true,
    isAvailable: true
  };
  
  if (options.hoursPerWeek) {
    query['availability.hoursPerWeek'] = { $gte: options.hoursPerWeek };
  }
  
  return this.find(query)
    .sort({ lastSeen: -1, reputation: -1 })
    .limit(options.limit || 100);
};

// Static method for advanced search
freelancerProfileSchema.statics.advancedSearch = function(criteria) {
  const query = { isActive: true };
  
  if (criteria.skills && criteria.skills.length > 0) {
    query['skills.name'] = { $in: criteria.skills };
  }
  
  if (criteria.categories && criteria.categories.length > 0) {
    query.categories = { $in: criteria.categories };
  }
  
  if (criteria.minRating) {
    query.reputation = { $gte: criteria.minRating };
  }
  
  if (criteria.budgetRange) {
    query.hourlyRate = {};
    if (criteria.budgetRange.min) query.hourlyRate.$gte = criteria.budgetRange.min;
    if (criteria.budgetRange.max) query.hourlyRate.$lte = criteria.budgetRange.max;
  }
  
  if (criteria.location) {
    if (criteria.location.country) {
      query['location.country'] = criteria.location.country;
    }
    if (criteria.location.isRemoteOnly !== undefined) {
      query['location.isRemoteOnly'] = criteria.location.isRemoteOnly;
    }
  }
  
  if (criteria.experienceLevel) {
    query.experienceLevel = { $in: criteria.experienceLevel };
  }
  
  if (criteria.availability) {
    query.isAvailable = true;
    if (criteria.availability.minHoursPerWeek) {
      query['availability.hoursPerWeek'] = { $gte: criteria.availability.minHoursPerWeek };
    }
  }
  
  return this.find(query)
    .sort({ reputation: -1, completedProjects: -1, lastSeen: -1 })
    .limit(criteria.limit || 50);
};

module.exports = mongoose.model('FreelancerProfile', freelancerProfileSchema);