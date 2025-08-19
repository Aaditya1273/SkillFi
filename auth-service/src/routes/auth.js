const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
const { SiweMessage } = require('siwe');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const EmailVerification = require('../models/EmailVerification');
const PasswordReset = require('../models/PasswordReset');
const WalletConnection = require('../models/WalletConnection');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});

// Helper function to generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Helper function to create auth session
const createAuthSession = async (userId, req) => {
  const session = new AuthSession({
    userId,
    deviceInfo: {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      deviceId: req.get('X-Device-ID')
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  await session.save();
  return session;
};

// 1. EMAIL REGISTRATION
router.post('/register', [
  generalLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('firstName').isLength({ min: 1, max: 50 }).trim(),
  body('lastName').isLength({ min: 1, max: 50 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, password, username, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      username,
      profile: {
        firstName,
        lastName
      },
      authMethods: ['email'],
      emailVerified: false
    });

    await user.save();

    // Create email verification
    const verification = new EmailVerification({
      userId: user._id,
      email,
      token: jwt.sign({ userId: user._id }, process.env.EMAIL_VERIFICATION_SECRET, { expiresIn: '24h' })
    });

    await verification.save();

    // Send verification email
    await sendVerificationEmail(email, verification.token, firstName);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful. Please check your email for verification.',
      userId: user._id
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 2. EMAIL LOGIN
router.post('/login', [
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        userId: user._id
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Create session
    const session = await createAuthSession(user._id, req);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        walletAddresses: user.walletAddresses,
        authMethods: user.authMethods
      },
      tokens: {
        accessToken,
        refreshToken
      },
      sessionId: session._id
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});/
/ 3. WALLET AUTHENTICATION - SIWE (Sign-In with Ethereum)
router.post('/wallet/nonce', [
  generalLimiter,
  body('address').matches(/^0x[a-fA-F0-9]{40}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const { address } = req.body;
    const nonce = Math.floor(Math.random() * 1000000).toString();

    // Store nonce in session
    req.session.siweNonce = nonce;
    req.session.walletAddress = address.toLowerCase();

    res.json({ nonce });

  } catch (error) {
    logger.error('Nonce generation error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

router.post('/wallet/verify', [
  authLimiter,
  body('message').isString(),
  body('signature').matches(/^0x[a-fA-F0-9]{130}$/),
  body('address').matches(/^0x[a-fA-F0-9]{40}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid signature data' });
    }

    const { message, signature, address } = req.body;

    // Verify the SIWE message
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    // Validate nonce and address
    if (fields.data.nonce !== req.session.siweNonce) {
      return res.status(401).json({ error: 'Invalid nonce' });
    }

    if (fields.data.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Address mismatch' });
    }

    // Clear nonce from session
    delete req.session.siweNonce;
    delete req.session.walletAddress;

    // Find or create user with wallet
    let user = await User.findOne({ 
      walletAddresses: { $elemMatch: { address: address.toLowerCase() } }
    });

    if (!user) {
      // Create new user with wallet
      user = new User({
        walletAddresses: [{
          address: address.toLowerCase(),
          chainId: fields.data.chainId || 1,
          isPrimary: true,
          verifiedAt: new Date()
        }],
        authMethods: ['wallet'],
        emailVerified: true, // Wallet users don't need email verification
        username: `user_${address.slice(-8)}`, // Generate username from address
        profile: {
          firstName: '',
          lastName: ''
        }
      });

      await user.save();
      logger.info(`New wallet user created: ${address}`);
    } else {
      // Update existing wallet verification
      const walletIndex = user.walletAddresses.findIndex(
        w => w.address === address.toLowerCase()
      );
      if (walletIndex !== -1) {
        user.walletAddresses[walletIndex].verifiedAt = new Date();
        user.lastLogin = new Date();
        await user.save();
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Create session
    const session = await createAuthSession(user._id, req);

    logger.info(`Wallet authentication successful: ${address}`);

    res.json({
      message: 'Wallet authentication successful',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        walletAddresses: user.walletAddresses,
        authMethods: user.authMethods
      },
      tokens: {
        accessToken,
        refreshToken
      },
      sessionId: session._id
    });

  } catch (error) {
    logger.error('Wallet verification error:', error);
    res.status(500).json({ error: 'Wallet authentication failed' });
  }
});

// 4. LINK WALLET TO EXISTING ACCOUNT
router.post('/wallet/link', [
  authenticateToken,
  generalLimiter,
  body('message').isString(),
  body('signature').matches(/^0x[a-fA-F0-9]{130}$/),
  body('address').matches(/^0x[a-fA-F0-9]{40}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid signature data' });
    }

    const { message, signature, address } = req.body;
    const userId = req.user.userId;

    // Verify the SIWE message
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (fields.data.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Address mismatch' });
    }

    // Check if wallet is already linked to another account
    const existingUser = await User.findOne({
      _id: { $ne: userId },
      walletAddresses: { $elemMatch: { address: address.toLowerCase() } }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Wallet already linked to another account' });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if wallet already linked to this user
    const existingWallet = user.walletAddresses.find(
      w => w.address === address.toLowerCase()
    );

    if (existingWallet) {
      return res.status(409).json({ error: 'Wallet already linked to your account' });
    }

    // Add wallet to user
    user.walletAddresses.push({
      address: address.toLowerCase(),
      chainId: fields.data.chainId || 1,
      isPrimary: user.walletAddresses.length === 0,
      verifiedAt: new Date()
    });

    // Add wallet to auth methods if not present
    if (!user.authMethods.includes('wallet')) {
      user.authMethods.push('wallet');
    }

    await user.save();

    logger.info(`Wallet linked to account: ${user.email} -> ${address}`);

    res.json({
      message: 'Wallet linked successfully',
      walletAddresses: user.walletAddresses
    });

  } catch (error) {
    logger.error('Wallet linking error:', error);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

// 5. UNLINK WALLET
router.delete('/wallet/unlink/:address', [
  authenticateToken,
  generalLimiter
], async (req, res) => {
  try {
    const { address } = req.params;
    const userId = req.user.userId;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find wallet
    const walletIndex = user.walletAddresses.findIndex(
      w => w.address === address.toLowerCase()
    );

    if (walletIndex === -1) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Check if user has other auth methods
    const hasEmail = user.authMethods.includes('email') && user.email;
    const hasOtherWallets = user.walletAddresses.length > 1;

    if (!hasEmail && !hasOtherWallets) {
      return res.status(400).json({ 
        error: 'Cannot unlink last authentication method. Please add email or another wallet first.' 
      });
    }

    // Remove wallet
    user.walletAddresses.splice(walletIndex, 1);

    // If no wallets left, remove wallet from auth methods
    if (user.walletAddresses.length === 0) {
      user.authMethods = user.authMethods.filter(method => method !== 'wallet');
    }

    await user.save();

    logger.info(`Wallet unlinked from account: ${user.email} -> ${address}`);

    res.json({
      message: 'Wallet unlinked successfully',
      walletAddresses: user.walletAddresses
    });

  } catch (error) {
    logger.error('Wallet unlinking error:', error);
    res.status(500).json({ error: 'Failed to unlink wallet' });
  }
});

// 6. EMAIL VERIFICATION
router.post('/verify-email', [
  generalLimiter,
  body('token').isString()
], async (req, res) => {
  try {
    const { token } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    const verification = await EmailVerification.findOne({
      userId: decoded.userId,
      token,
      used: false
    });

    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Update user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.emailVerified = true;
    await user.save();

    // Mark verification as used
    verification.used = true;
    verification.usedAt = new Date();
    await verification.save();

    logger.info(`Email verified: ${user.email}`);

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// 7. RESEND EMAIL VERIFICATION
router.post('/resend-verification', [
  generalLimiter,
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a verification link has been sent.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Delete old verification tokens
    await EmailVerification.deleteMany({ userId: user._id });

    // Create new verification
    const verification = new EmailVerification({
      userId: user._id,
      email,
      token: jwt.sign({ userId: user._id }, process.env.EMAIL_VERIFICATION_SECRET, { expiresIn: '24h' })
    });

    await verification.save();

    // Send verification email
    await sendVerificationEmail(email, verification.token, user.profile.firstName);

    res.json({ message: 'Verification email sent' });

  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});// 8. P
ASSWORD RESET REQUEST
router.post('/forgot-password', [
  generalLimiter,
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Delete old reset tokens
    await PasswordReset.deleteMany({ userId: user._id });

    // Create reset token
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.PASSWORD_RESET_SECRET,
      { expiresIn: '1h' }
    );

    const passwordReset = new PasswordReset({
      userId: user._id,
      email,
      token: resetToken
    });

    await passwordReset.save();

    // Send reset email
    await sendPasswordResetEmail(email, resetToken, user.profile.firstName);

    logger.info(`Password reset requested: ${email}`);

    res.json({ message: 'Password reset email sent' });

  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

// 9. PASSWORD RESET
router.post('/reset-password', [
  generalLimiter,
  body('token').isString(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid password format' });
    }

    const { token, password } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.PASSWORD_RESET_SECRET);
    const passwordReset = await PasswordReset.findOne({
      userId: decoded.userId,
      token,
      used: false
    });

    if (!passwordReset) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update user password
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    await user.save();

    // Mark reset token as used
    passwordReset.used = true;
    passwordReset.usedAt = new Date();
    await passwordReset.save();

    // Invalidate all existing sessions
    await AuthSession.deleteMany({ userId: user._id });

    logger.info(`Password reset completed: ${user.email}`);

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    logger.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// 10. REFRESH TOKEN
router.post('/refresh', [
  generalLimiter,
  body('refreshToken').isString()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    res.json({
      message: 'Tokens refreshed successfully',
      tokens
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// 11. LOGOUT
router.post('/logout', [
  authenticateToken,
  generalLimiter
], async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.body.sessionId;

    if (sessionId) {
      // Logout specific session
      await AuthSession.findOneAndDelete({ _id: sessionId, userId });
    } else {
      // Logout all sessions
      await AuthSession.deleteMany({ userId });
    }

    // Clear session
    req.session.destroy();

    logger.info(`User logged out: ${userId}`);

    res.json({ message: 'Logout successful' });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// 12. GET USER PROFILE
router.get('/profile', [
  authenticateToken,
  generalLimiter
], async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).populate('walletAddresses');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        walletAddresses: user.walletAddresses,
        authMethods: user.authMethods,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 13. UPDATE PROFILE
router.put('/profile', [
  authenticateToken,
  generalLimiter,
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('username').optional().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const userId = req.user.userId;
    const { firstName, lastName, username } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check username uniqueness if provided
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      user.username = username;
    }

    // Update profile fields
    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;

    await user.save();

    logger.info(`Profile updated: ${user.email}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        walletAddresses: user.walletAddresses,
        authMethods: user.authMethods
      }
    });

  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 14. GET ACTIVE SESSIONS
router.get('/sessions', [
  authenticateToken,
  generalLimiter
], async (req, res) => {
  try {
    const userId = req.user.userId;

    const sessions = await AuthSession.find({ userId }).sort({ createdAt: -1 });

    res.json({
      sessions: sessions.map(session => ({
        id: session._id,
        deviceInfo: session.deviceInfo,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isActive: session.expiresAt > new Date()
      }))
    });

  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// 15. REVOKE SESSION
router.delete('/sessions/:sessionId', [
  authenticateToken,
  generalLimiter
], async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    const session = await AuthSession.findOneAndDelete({ 
      _id: sessionId, 
      userId 
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session revoked successfully' });

  } catch (error) {
    logger.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

module.exports = router;