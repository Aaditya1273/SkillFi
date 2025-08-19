const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initializeQueues } = require('./config/queues');
const rateLimiter = require('./middleware/rateLimiter');
const auth = require('./middleware/auth');

// Route imports
const matchingRoutes = require('./routes/matching');
const embeddingsRoutes = require('./routes/embeddings');
const analyticsRoutes = require('./routes/analytics');
const healthRoutes = require('./routes/health');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', rateLimiter);

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/matching', auth, matchingRoutes);
app.use('/api/embeddings', auth, embeddingsRoutes);
app.use('/api/analytics', auth, analyticsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.IO for real-time matching updates
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-matching-room', (userId) => {
    socket.join(`user-${userId}`);
    logger.info(`User ${userId} joined matching room`);
  });

  socket.on('request-matches', async (data) => {
    try {
      const { userId, projectId, type } = data;
      // Emit real-time matching updates
      socket.emit('matching-progress', { status: 'processing', progress: 0 });
      
      // This would trigger the matching process
      // Results will be emitted via the matching service
    } catch (error) {
      socket.emit('matching-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Initialize services
async function initializeServices() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Initialize job queues
    await initializeQueues();
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;

// Start server
initializeServices().then(() => {
  server.listen(PORT, () => {
    logger.info(`🚀 AI Matching Engine running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'Connected' : 'Not configured'}`);
  });
});

module.exports = { app, server, io };