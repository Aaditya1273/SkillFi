const mongoose = require('mongoose');

const socialAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['google', 'github', 'linkedin'],
    index: true
  },
  providerId: {
    type: String,
    required: true,
    index: true
  },
  profile: {
    name: String,
    email: String,
    image: String,
    username: String,
    profileUrl: String,
    raw: mongoose.Schema.Types.Mixed // Store full provider profile
  }
}, {
  timestamps: true
});

// Compound index for provider + providerId uniqueness
socialAccountSchema.index({ provider: 1, providerId: 1 }, { unique: true });

// Index for user + provider combination
socialAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('SocialAccount', socialAccountSchema);
