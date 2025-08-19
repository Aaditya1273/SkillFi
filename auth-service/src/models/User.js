const mongoose = require('mongoose');

const walletAddressSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/
  },
  chainId: {
    type: Number,
    default: 1
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    sparse: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    select: false // Don't include in queries by default
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  profile: {
    firstName: {
      type: String,
      maxlength: 50,
      trim: true
    },
    lastName: {
      type: String,
      maxlength: 50,
      trim: true
    },
    avatar: {
      type: String
    },
    bio: {
      type: String,
      maxlength: 500
    }
  },
  walletAddresses: [walletAddressSchema],
  authMethods: [{
    type: String,
    enum: ['email', 'wallet', 'google', 'github', 'linkedin'],
    required: true
  }],
  emailVerified: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.twoFactorSecret;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ 'walletAddresses.address': 1 });
userSchema.index({ authMethods: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('profile.fullName').get(function() {
  return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
});

// Method to get primary wallet
userSchema.methods.getPrimaryWallet = function() {
  return this.walletAddresses.find(wallet => wallet.isPrimary) || this.walletAddresses[0];
};

// Method to check if user has specific auth method
userSchema.methods.hasAuthMethod = function(method) {
  return this.authMethods.includes(method);
};

// Pre-save middleware to ensure at least one primary wallet
userSchema.pre('save', function(next) {
  if (this.walletAddresses.length > 0) {
    const hasPrimary = this.walletAddresses.some(wallet => wallet.isPrimary);
    if (!hasPrimary) {
      this.walletAddresses[0].isPrimary = true;
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);