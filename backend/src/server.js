const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: '../.env' });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const proposalRoutes = require('./routes/proposals');
const messageRoutes = require('./routes/messages');
const contractRoutes = require('./routes/contracts');
const ratingRoutes = require('./routes/ratings');
const reputationRoutes = require('./routes/reputation');
const onchainListeners = require('./services/onchainListeners');
const disputeRoutes = require('./routes/disputes');
const referralRoutes = require('./routes/referrals');

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
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/referrals', referralRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.IO for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
  });

  socket.on('send-message', (data) => {
    socket.to(`project-${data.projectId}`).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  // Optionally start on-chain listeners
  if (process.env.ONCHAIN_LISTENERS === '1') {
    const rpcUrl = process.env.RPC_URL;
    const contractAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS;
    const started = onchainListeners.start({ rpcUrl, contractAddress });
    if (!rpcUrl || !contractAddress) {
      console.warn('[server] ONCHAIN_LISTENERS=1 but RPC_URL or MARKETPLACE_CONTRACT_ADDRESS missing');
    }
    if (started) {
      process.on('SIGINT', () => {
        started.stop();
        process.exit(0);
      });
    }
  }
});