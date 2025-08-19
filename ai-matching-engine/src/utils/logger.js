const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Create logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'exceptions.log') 
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'rejections.log') 
    })
  ],
  exitOnError: false,
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add custom methods for specific use cases
logger.matching = (message, data = {}) => {
  logger.info(`[MATCHING] ${message}`, data);
};

logger.embedding = (message, data = {}) => {
  logger.info(`[EMBEDDING] ${message}`, data);
};

logger.optimization = (message, data = {}) => {
  logger.info(`[OPTIMIZATION] ${message}`, data);
};

logger.performance = (message, data = {}) => {
  logger.info(`[PERFORMANCE] ${message}`, data);
};

logger.api = (message, data = {}) => {
  logger.http(`[API] ${message}`, data);
};

logger.cache = (message, data = {}) => {
  logger.debug(`[CACHE] ${message}`, data);
};

logger.ml = (message, data = {}) => {
  logger.info(`[ML] ${message}`, data);
};

// Performance timing helper
logger.time = (label) => {
  const start = process.hrtime.bigint();
  return {
    end: () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      logger.performance(`${label} completed in ${duration.toFixed(2)}ms`);
      return duration;
    }
  };
};

// Request logging helper
logger.request = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const { statusCode } = res;
    
    logger.http(`${method} ${url} ${statusCode} ${duration}ms - ${ip}`);
  });
  
  if (next) next();
};

// Error logging helper with context
logger.errorWithContext = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  };
  
  logger.error('Error occurred:', errorInfo);
};

// Structured logging for analytics
logger.analytics = (event, data = {}) => {
  logger.info(`[ANALYTICS] ${event}`, {
    timestamp: new Date().toISOString(),
    event,
    ...data
  });
};

// Memory usage logging
logger.memory = () => {
  const used = process.memoryUsage();
  const memoryInfo = {};
  
  for (let key in used) {
    memoryInfo[key] = Math.round(used[key] / 1024 / 1024 * 100) / 100 + ' MB';
  }
  
  logger.debug('Memory usage:', memoryInfo);
  return memoryInfo;
};

// Health check logging
logger.health = (service, status, details = {}) => {
  const level = status === 'healthy' ? 'info' : 'warn';
  logger[level](`[HEALTH] ${service}: ${status}`, details);
};

module.exports = logger;