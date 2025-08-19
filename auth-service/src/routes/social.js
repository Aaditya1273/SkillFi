const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const SocialAccount = require('../models/SocialAccount');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Link social account to existing user or create new user
router.post('/link', [
  body('provider').isIn(['google', 'github', 'linkedin']),
  body('providerId').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('name').optional().trim(),
  body('image').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { provider, providerId, email, name, image, profile } = req.body;

    // Check if social account already exists
    const existingSocial = await SocialAccount.findOne({
      provider,
      providerId
    });

    if (existingSocial) {
      // Return existing user
      const user = await User.findById(existingSocial.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress,
          avatar: user.avatar
        }
      });
    }

    // Check if user exists with this email
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user from social profile
      const nameParts = name ? name.split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Generate unique username from email or name
      let username = email.split('@')[0];
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        username = `${username}_${Date.now()}`;
      }

      user = new User({
        email,
        username,
        firstName,
        lastName,
        avatar: image,
        emailVerified: true, // Social accounts are pre-verified
        profile: {
          bio: profile?.bio || '',
          location: profile?.location || '',
          website: profile?.blog || profile?.html_url || '',
          socialLinks: {
            [provider]: profile?.html_url || profile?.profileUrl || ''
          }
        },
        preferences: {
          emailNotifications: true,
          marketingEmails: false
        }
      });

      await user.save();
      logger.info(`New user created via ${provider}: ${email}`);
    }

    // Link social account to user
    const socialAccount = new SocialAccount({
      userId: user._id,
      provider,
      providerId,
      profile: {
        name,
        email,
        image,
        username: profile?.login || profile?.username || '',
        profileUrl: profile?.html_url || profile?.profileUrl || '',
        raw: profile
      }
    });

    await socialAccount.save();

    // Update user's social links if not already present
    if (!user.profile.socialLinks[provider]) {
      user.profile.socialLinks[provider] = profile?.html_url || profile?.profileUrl || '';
      await user.save();
    }

    logger.info(`Social account linked: ${provider} for user ${user.email}`);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        walletAddress: user.walletAddress,
        avatar: user.avatar || image
      }
    });

  } catch (error) {
    logger.error('Social linking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlink social account
router.delete('/unlink/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user.userId;

    if (!['google', 'github', 'linkedin'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const socialAccount = await SocialAccount.findOneAndDelete({
      userId,
      provider
    });

    if (!socialAccount) {
      return res.status(404).json({ error: 'Social account not found' });
    }

    // Remove social link from user profile
    const user = await User.findById(userId);
    if (user && user.profile.socialLinks[provider]) {
      delete user.profile.socialLinks[provider];
      await user.save();
    }

    logger.info(`Social account unlinked: ${provider} for user ${userId}`);

    res.json({ message: 'Social account unlinked successfully' });

  } catch (error) {
    logger.error('Social unlinking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's linked social accounts
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const socialAccounts = await SocialAccount.find({ userId }).select('-profile.raw');

    const accounts = socialAccounts.map(account => ({
      provider: account.provider,
      profile: {
        name: account.profile.name,
        username: account.profile.username,
        image: account.profile.image,
        profileUrl: account.profile.profileUrl
      },
      linkedAt: account.createdAt
    }));

    res.json({ accounts });

  } catch (error) {
    logger.error('Get social accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Connect wallet to social account user
router.post('/connect-wallet', [
  authenticateToken,
  body('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/),
  body('message').notEmpty(),
  body('signature').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { walletAddress, message, signature } = req.body;
    const userId = req.user.userId;

    // Verify SIWE message (same logic as wallet auth)
    const { SiweMessage } = require('siwe');
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (fields.data.address.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Address mismatch' });
    }

    // Check if wallet is already connected to another user
    const existingWallet = await User.findOne({
      walletAddress: walletAddress.toLowerCase(),
      _id: { $ne: userId }
    });

    if (existingWallet) {
      return res.status(409).json({ error: 'Wallet already connected to another account' });
    }

    // Update user with wallet address
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        walletAddress: walletAddress.toLowerCase(),
        walletConnectedAt: new Date()
      },
      { new: true }
    );

    logger.info(`Wallet connected to social user: ${walletAddress} -> ${user.email}`);

    res.json({
      message: 'Wallet connected successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress
      }
    });

  } catch (error) {
    logger.error('Wallet connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
