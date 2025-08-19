const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initializeQueues } = require('./config/queues');
const { createGraphQLSchema } = require('./graphql/schema');
const { createContext } = require('./graphql/context');

// Middleware imports
const rateLimiter = require('./middleware/rateLimiter');
const auth = require('./middleware/auth');
const validation = require('./middleware/validation');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const proposalRoutes = require('./routes/proposals');
const contractRoutes = require('./routes/contracts');
const reviewRoutes = require('./routes/reviews');
const stakingRoutes = require('./routes/staking');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SkillFi API Gateway',
      version: '1.0.0',
      description: 'Comprehensive API for SkillFi freelance marketplace platform',
      contact: {
        name: 'SkillFi Team',
        email: 'api@skillfi.io'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:4000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Basic middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(morgan('combined', { 
  stream: { write: message => logger.info(message.trim()) } 
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', rateLimiter);

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SkillFi API Documentation'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', auth.requireRole('admin'), adminRoutes);

// GraphQL endpoint will be added after server creation
let apolloServer;

// Socket.IO event handlers
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join user-specific room
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined room`);
  });

  // Join project-specific room
  socket.on('join-project', (projectId) => {
    socket.join(`project:${projectId}`);
    logger.info(`Joined project room: ${projectId}`);
  });

  // Handle real-time messaging
  socket.on('send-message', (data) => {
    socket.to(`project:${data.projectId}`).emit('new-message', data);
  });

  // Handle proposal updates
  socket.on('proposal-update', (data) => {
    socket.to(`project:${data.projectId}`).emit('proposal-updated', data);
  });

  // Handle contract updates
  socket.on('contract-update', (data) => {
    io.to(`user:${data.clientId}`).emit('contract-updated', data);
    io.to(`user:${data.freelancerId}`).emit('contract-updated', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Initialize job queues
    await initializeQueues();
    
    // Create GraphQL schema
    const schema = await createGraphQLSchema();
    
    // Create Apollo Server
    apolloServer = new ApolloServer({
      schema,
      context: createContext,
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
      formatError: (error) => {
        logger.error('GraphQL Error:', error);
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path
        };
      },
      plugins: [
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                logger.info(`GraphQL Operation: ${requestContext.request.operationName}`);
              },
              didEncounterErrors(requestContext) {
                logger.error('GraphQL Errors:', requestContext.errors);
              }
            };
          }
        }
      ]
    });

    // Start Apollo Server
    await apolloServer.start();
    
    // Apply GraphQL middleware
    apolloServer.applyMiddleware({ 
      app, 
      path: '/graphql',
      cors: false // We handle CORS above
    });

    const PORT = process.env.PORT || 4000;
    
    server.listen(PORT, () => {
      logger.info(`🚀 SkillFi API Gateway running on port ${PORT}`);
      logger.info(`📚 REST API: http://localhost:${PORT}/api`);
      logger.info(`🎯 GraphQL: http://localhost:${PORT}${apolloServer.graphqlPath}`);
      logger.info(`📖 Documentation: http://localhost:${PORT}/docs`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    if (apolloServer) {
      await apolloServer.stop();
      logger.info('Apollo Server stopped');
    }
    
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server, io };