const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Add user info to request
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || []
    };

    // Log API access
    logger.api(`User ${req.user.id} accessing ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(500).json({ 
      error: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
        permissions: decoded.permissions || []
      };
    }
    
    next();
  } catch (error) {
    // Continue without user info if token is invalid
    logger.debug('Optional auth failed, continuing without user:', error.message);
    next();
  }
};

// Admin auth middleware
const adminAuth = async (req, res, next) => {
  try {
    // First run regular auth
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Check if user is admin
    if (req.user.role !== 'admin' && !req.user.permissions.includes('admin')) {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// API key auth middleware (for service-to-service communication)
const apiKeyAuth = (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    const validApiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required.',
        code: 'NO_API_KEY'
      });
    }
    
    if (!validApiKeys.includes(apiKey)) {
      return res.status(401).json({ 
        error: 'Invalid API key.',
        code: 'INVALID_API_KEY'
      });
    }
    
    // Set service user context
    req.user = {
      id: 'service',
      role: 'service',
      permissions: ['service']
    };
    
    logger.api(`Service access with API key: ${req.method} ${req.path}`);
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// Permission-based auth middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required.',
        code: 'NO_AUTH'
      });
    }
    
    if (req.user.role === 'admin' || req.user.permissions.includes(permission)) {
      return next();
    }
    
    return res.status(403).json({ 
      error: `Permission '${permission}' required.`,
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  };
};

// Rate limiting by user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    }
    
    const userRequests = requests.get(userId) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    next();
  };
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  apiKeyAuth,
  requirePermission,
  userRateLimit
};