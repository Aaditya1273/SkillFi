const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        // Reconnect after
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    logger.info('Redis ping successful');

  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

const disconnectRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    throw error;
  }
};

const getRedisStatus = async () => {
  try {
    if (!redisClient) {
      return { status: 'disconnected' };
    }

    const info = await redisClient.info();
    const dbSize = await redisClient.dbSize();
    
    return {
      status: 'connected',
      dbSize,
      info: info.split('\r\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      }, {})
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};

// Cache helper functions
const cacheHelpers = {
  // Set with expiration
  setex: async (key, seconds, value) => {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await redisClient.setEx(key, seconds, serializedValue);
    } catch (error) {
      logger.error('Redis setex error:', error);
      throw error;
    }
  },

  // Get and parse JSON
  get: async (key) => {
    try {
      const value = await redisClient.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string if not JSON
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      throw error;
    }
  },

  // Delete key
  del: async (key) => {
    try {
      return await redisClient.del(key);
    } catch (error) {
      logger.error('Redis del error:', error);
      throw error;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      logger.error('Redis exists error:', error);
      throw error;
    }
  },

  // Set hash field
  hset: async (key, field, value) => {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await redisClient.hSet(key, field, serializedValue);
    } catch (error) {
      logger.error('Redis hset error:', error);
      throw error;
    }
  },

  // Get hash field
  hget: async (key, field) => {
    try {
      const value = await redisClient.hGet(key, field);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error('Redis hget error:', error);
      throw error;
    }
  },

  // Get all hash fields
  hgetall: async (key) => {
    try {
      const hash = await redisClient.hGetAll(key);
      const parsed = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }
      
      return parsed;
    } catch (error) {
      logger.error('Redis hgetall error:', error);
      throw error;
    }
  },

  // Add to set
  sadd: async (key, ...members) => {
    try {
      return await redisClient.sAdd(key, members);
    } catch (error) {
      logger.error('Redis sadd error:', error);
      throw error;
    }
  },

  // Get set members
  smembers: async (key) => {
    try {
      return await redisClient.sMembers(key);
    } catch (error) {
      logger.error('Redis smembers error:', error);
      throw error;
    }
  },

  // Add to sorted set
  zadd: async (key, score, member) => {
    try {
      return await redisClient.zAdd(key, { score, value: member });
    } catch (error) {
      logger.error('Redis zadd error:', error);
      throw error;
    }
  },

  // Get sorted set range
  zrange: async (key, start, stop, withScores = false) => {
    try {
      if (withScores) {
        return await redisClient.zRangeWithScores(key, start, stop);
      }
      return await redisClient.zRange(key, start, stop);
    } catch (error) {
      logger.error('Redis zrange error:', error);
      throw error;
    }
  },

  // Increment counter
  incr: async (key) => {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.error('Redis incr error:', error);
      throw error;
    }
  },

  // Set expiration
  expire: async (key, seconds) => {
    try {
      return await redisClient.expire(key, seconds);
    } catch (error) {
      logger.error('Redis expire error:', error);
      throw error;
    }
  },

  // Get keys by pattern
  keys: async (pattern) => {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error:', error);
      throw error;
    }
  },

  // Flush database
  flushdb: async () => {
    try {
      return await redisClient.flushDb();
    } catch (error) {
      logger.error('Redis flushdb error:', error);
      throw error;
    }
  },

  // Ping
  ping: async () => {
    try {
      return await redisClient.ping();
    } catch (error) {
      logger.error('Redis ping error:', error);
      throw error;
    }
  }
};

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisStatus,
  redisClient: new Proxy({}, {
    get: (target, prop) => {
      if (cacheHelpers[prop]) {
        return cacheHelpers[prop];
      }
      if (redisClient && redisClient[prop]) {
        return redisClient[prop].bind(redisClient);
      }
      throw new Error(`Redis method ${prop} not found`);
    }
  })
};