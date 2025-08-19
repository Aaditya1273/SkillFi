const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  deadline: Date,
  deliverables: [String],
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: Date
});

const jobPostSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  category: {
    type: String,
    required: true,
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
  },
  subcategory: String,
  
  // Client Information
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientCompany: {
    name: String,
    size: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise']
    },
    industry: String
  },
  
  // Project Requirements
  requiredSkills: [{
    type: String,
    required: true,
    trim: true
  }],
  preferredSkills: [String],
  experienceLevel: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'expert', 'any'],
    default: 'any'
  },
  
  // Budget and Timeline
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  budgetType: {
    type: String,
    enum: ['fixed', 'hourly', 'milestone-based'],
    required: true
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  hourlyRateRange: {
    min: Number,
    max: Number
  },
  
  // Timeline
  timeline: {
    type: String,
    required: true
  },
  startDate: Date,
  deadline: Date,
  estimatedHours: Number,
  
  // Project Structure
  milestones: [milestoneSchema],
  deliverables: [String],
  
  // Location and Work Arrangement
  location: {
    type: String,
    default: 'Remote'
  },
  workArrangement: {
    type: String,
    enum: ['remote', 'onsite', 'hybrid'],
    default: 'remote'
  },
  timezone: String,
  
  // Project Details
  projectType: {
    type: String,
    enum: ['one-time', 'ongoing', 'contract-to-hire'],
    default: 'one-time'
  },
  complexity: {
    type: String,
    enum: ['simple', 'moderate', 'complex', 'expert-level'],
    default: 'moderate'
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Requirements and Preferences
  requirements: {
    portfolioRequired: {
      type: Boolean,
      default: false
    },
    interviewRequired: {
      type: Boolean,
      default: false
    },
    testProjectRequired: {
      type: Boolean,
      default: false
    },
    nda: {
      type: Boolean,
      default: false
    },
    backgroundCheck: {
      type: Boolean,
      default: false
    }
  },
  
  preferences: {
    communicationStyle: {
      type: String,
      enum: ['formal', 'casual', 'collaborative', 'independent']
    },
    reportingFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'milestone-based']
    },
    preferredFreelancerType: {
      type: String,
      enum: ['individual', 'agency', 'team', 'any'],
      default: 'any'
    }
  },
  
  // Application and Selection
  applicationDeadline: Date,
  maxProposals: {
    type: Number,
    default: 50,
    max: 100
  },
  proposalCount: {
    type: Number,
    default: 0
  },
  shortlistedFreelancers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FreelancerProfile'
  }],
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'open', 'in-review', 'in-progress', 'completed', 'cancelled', 'paused'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invited-only'],
    default: 'public'
  },
  
  // Selected Freelancer and Contract
  selectedFreelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FreelancerProfile'
  },
  contractId: String, // Reference to smart contract
  escrowAmount: Number,
  
  // AI and Matching Data
  embeddingVector: [Number], // Cached embedding for faster matching
  embeddingUpdatedAt: Date,
  matchingCriteria: {
    semanticWeight: {
      type: Number,
      default: 0.35
    },
    skillsWeight: {
      type: Number,
      default: 0.25
    },
    experienceWeight: {
      type: Number,
      default: 0.15
    },
    budgetWeight: {
      type: Number,
      default: 0.10
    }
  },
  
  // Analytics and Performance
  views: {
    type: Number,
    default: 0
  },
  uniqueViews: {
    type: Number,
    default: 0
  },
  viewerIds: [String], // Track unique viewers
  
  // SEO and Discovery
  tags: [String],
  searchKeywords: [String],
  
  // Timestamps
  postedAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
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
jobPostSchema.index({ client: 1 });
jobPostSchema.index({ category: 1 });
jobPostSchema.index({ requiredSkills: 1 });
jobPostSchema.index({ status: 1 });
jobPostSchema.index({ budget: 1 });
jobPostSchema.index({ postedAt: -1 });
jobPostSchema.index({ deadline: 1 });
jobPostSchema.index({ experienceLevel: 1 });
jobPostSchema.index({ workArrangement: 1 });
jobPostSchema.index({ urgency: 1 });

// Compound indexes for common queries
jobPostSchema.index({ 
  status: 1, 
  category: 1, 
  requiredSkills: 1, 
  budget: 1 
});

jobPostSchema.index({ 
  status: 1, 
  postedAt: -1, 
  urgency: 1 
});

jobPostSchema.index({ 
  visibility: 1, 
  status: 1, 
  applicationDeadline: 1 
});

// Text index for search functionality
jobPostSchema.index({
  title: 'text',
  description: 'text',
  requiredSkills: 'text',
  tags: 'text'
});

// Virtual for days since posted
jobPostSchema.virtual('daysSincePosted').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.postedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for time until deadline
jobPostSchema.virtual('timeUntilDeadline').get(function() {
  if (!this.deadline) return null;
  
  const now = new Date();
  const diffTime = this.deadline - now;
  
  if (diffTime < 0) return 'Expired';
  
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} days`;
  if (hours > 0) return `${hours} hours`;
  return 'Less than 1 hour';
});

// Virtual for budget per hour estimate
jobPostSchema.virtual('estimatedHourlyRate').get(function() {
  if (this.budgetType === 'hourly') return this.budget;
  if (this.estimatedHours && this.estimatedHours > 0) {
    return this.budget / this.estimatedHours;
  }
  return null;
});

// Virtual for application status
jobPostSchema.virtual('applicationStatus').get(function() {
  if (this.status !== 'open') return 'closed';
  if (this.applicationDeadline && new Date() > this.applicationDeadline) return 'expired';
  if (this.proposalCount >= this.maxProposals) return 'full';
  return 'open';
});

// Pre-save middleware
jobPostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastModified = new Date();
  
  // Auto-generate search keywords
  if (this.isModified('title') || this.isModified('description') || this.isModified('requiredSkills')) {
    this.searchKeywords = this.generateSearchKeywords();
  }
  
  next();
});

// Method to generate search keywords
jobPostSchema.methods.generateSearchKeywords = function() {
  const keywords = new Set();
  
  // Add title words
  if (this.title) {
    this.title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
  }
  
  // Add skills
  this.requiredSkills.forEach(skill => {
    keywords.add(skill.toLowerCase());
  });
  
  // Add category
  if (this.category) {
    keywords.add(this.category.replace('-', ' '));
  }
  
  // Add common variations
  const variations = {
    'javascript': ['js', 'node', 'nodejs'],
    'typescript': ['ts'],
    'react': ['reactjs'],
    'vue': ['vuejs'],
    'angular': ['angularjs'],
    'python': ['py'],
    'machine-learning': ['ml', 'ai', 'artificial-intelligence'],
    'web-development': ['frontend', 'backend', 'fullstack']
  };
  
  keywords.forEach(keyword => {
    if (variations[keyword]) {
      variations[keyword].forEach(variant => keywords.add(variant));
    }
  });
  
  return Array.from(keywords);
};

// Method to increment view count
jobPostSchema.methods.incrementViews = function(viewerId = null) {
  this.views += 1;
  
  if (viewerId && !this.viewerIds.includes(viewerId)) {
    this.uniqueViews += 1;
    this.viewerIds.push(viewerId);
    
    // Keep only last 1000 viewer IDs to prevent unlimited growth
    if (this.viewerIds.length > 1000) {
      this.viewerIds = this.viewerIds.slice(-1000);
    }
  }
  
  return this.save();
};

// Method to add proposal
jobPostSchema.methods.addProposal = function() {
  this.proposalCount += 1;
  return this.save();
};

// Method to shortlist freelancer
jobPostSchema.methods.shortlistFreelancer = function(freelancerId) {
  if (!this.shortlistedFreelancers.includes(freelancerId)) {
    this.shortlistedFreelancers.push(freelancerId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove from shortlist
jobPostSchema.methods.removeFromShortlist = function(freelancerId) {
  this.shortlistedFreelancers = this.shortlistedFreelancers.filter(
    id => id.toString() !== freelancerId.toString()
  );
  return this.save();
};

// Method to select freelancer
jobPostSchema.methods.selectFreelancer = function(freelancerId) {
  this.selectedFreelancer = freelancerId;
  this.status = 'in-progress';
  return this.save();
};

// Method to check if job is still accepting applications
jobPostSchema.methods.isAcceptingApplications = function() {
  if (this.status !== 'open') return false;
  if (this.applicationDeadline && new Date() > this.applicationDeadline) return false;
  if (this.proposalCount >= this.maxProposals) return false;
  return true;
};

// Static method to find active jobs
jobPostSchema.statics.findActive = function(options = {}) {
  const query = {
    status: 'open',
    visibility: 'public'
  };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.skills && options.skills.length > 0) {
    query.requiredSkills = { $in: options.skills };
  }
  
  if (options.budgetRange) {
    query.budget = {};
    if (options.budgetRange.min) query.budget.$gte = options.budgetRange.min;
    if (options.budgetRange.max) query.budget.$lte = options.budgetRange.max;
  }
  
  if (options.experienceLevel) {
    query.experienceLevel = { $in: [options.experienceLevel, 'any'] };
  }
  
  return this.find(query)
    .populate('client', 'name reputation avatar')
    .sort({ urgency: -1, postedAt: -1 })
    .limit(options.limit || 50);
};

// Static method for advanced search
jobPostSchema.statics.advancedSearch = function(criteria) {
  const query = {
    status: 'open',
    visibility: 'public'
  };
  
  if (criteria.keywords) {
    query.$text = { $search: criteria.keywords };
  }
  
  if (criteria.category && criteria.category.length > 0) {
    query.category = { $in: criteria.category };
  }
  
  if (criteria.skills && criteria.skills.length > 0) {
    query.requiredSkills = { $in: criteria.skills };
  }
  
  if (criteria.budgetRange) {
    query.budget = {};
    if (criteria.budgetRange.min) query.budget.$gte = criteria.budgetRange.min;
    if (criteria.budgetRange.max) query.budget.$lte = criteria.budgetRange.max;
  }
  
  if (criteria.budgetType) {
    query.budgetType = { $in: criteria.budgetType };
  }
  
  if (criteria.experienceLevel && criteria.experienceLevel.length > 0) {
    query.$or = [
      { experienceLevel: { $in: criteria.experienceLevel } },
      { experienceLevel: 'any' }
    ];
  }
  
  if (criteria.workArrangement) {
    query.workArrangement = { $in: criteria.workArrangement };
  }
  
  if (criteria.projectType) {
    query.projectType = { $in: criteria.projectType };
  }
  
  if (criteria.urgency) {
    query.urgency = { $in: criteria.urgency };
  }
  
  if (criteria.postedWithin) {
    const date = new Date();
    date.setDate(date.getDate() - criteria.postedWithin);
    query.postedAt = { $gte: date };
  }
  
  const sortOptions = {};
  if (criteria.sortBy) {
    switch (criteria.sortBy) {
      case 'newest':
        sortOptions.postedAt = -1;
        break;
      case 'budget-high':
        sortOptions.budget = -1;
        break;
      case 'budget-low':
        sortOptions.budget = 1;
        break;
      case 'deadline':
        sortOptions.deadline = 1;
        break;
      case 'relevance':
        if (criteria.keywords) {
          sortOptions.score = { $meta: 'textScore' };
        }
        break;
      default:
        sortOptions.postedAt = -1;
    }
  } else {
    sortOptions.postedAt = -1;
  }
  
  return this.find(query)
    .populate('client', 'name reputation avatar company')
    .sort(sortOptions)
    .limit(criteria.limit || 50);
};

// Static method to find similar jobs
jobPostSchema.statics.findSimilar = function(jobId, limit = 5) {
  return this.findById(jobId).then(job => {
    if (!job) return [];
    
    const query = {
      _id: { $ne: jobId },
      status: 'open',
      $or: [
        { category: job.category },
        { requiredSkills: { $in: job.requiredSkills } },
        { tags: { $in: job.tags || [] } }
      ]
    };
    
    return this.find(query)
      .populate('client', 'name reputation avatar')
      .sort({ postedAt: -1 })
      .limit(limit);
  });
};

// Static method to get trending jobs
jobPostSchema.statics.findTrending = function(limit = 20) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.find({
    status: 'open',
    postedAt: { $gte: oneDayAgo }
  })
  .populate('client', 'name reputation avatar')
  .sort({ views: -1, proposalCount: -1, postedAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('JobPost', jobPostSchema);