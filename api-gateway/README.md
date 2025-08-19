# SkillFi API Gateway

A comprehensive API Gateway providing both REST and GraphQL endpoints for the SkillFi freelance marketplace platform. Built with Express.js, Apollo Server, and MongoDB.

## 🚀 Features

### API Types
- **REST API** - Traditional RESTful endpoints with OpenAPI/Swagger documentation
- **GraphQL API** - Flexible query language with Apollo Server
- **Real-time WebSocket** - Live updates for messaging, notifications, and contract events

### Core Functionality
- **User Management** - Registration, authentication, profiles, and settings
- **Job Marketplace** - Job posting, searching, filtering, and matching
- **Proposal System** - Bid submission, evaluation, and selection
- **Smart Contracts** - Blockchain integration for escrow and payments
- **Reviews & Ratings** - Reputation system with detailed feedback
- **Token Staking** - SKILL token staking with rewards and governance
- **File Upload** - Avatar and document upload with image processing
- **Notifications** - Email, push, and in-app notifications

### Advanced Features
- **AI Matching** - Integration with AI matching engine
- **Rate Limiting** - Per-user and global rate limiting
- **Caching** - Redis-based caching for performance
- **Analytics** - Comprehensive usage and performance tracking
- **Admin Panel** - Administrative endpoints and controls

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Microservices  │
│  (React/Vue)    │◄──►│  (Express +     │◄──►│   (Matching,    │
│                 │    │   Apollo)       │    │   Blockchain)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Cache +      │
                       │    Sessions)    │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │    MongoDB      │
                       │   (Database)    │
                       └─────────────────┘
```

## 📚 API Documentation

### REST API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation

#### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/avatar` - Upload user avatar
- `GET /api/users/freelancer-profile` - Get freelancer profile
- `POST /api/users/freelancer-profile` - Create/update freelancer profile
- `GET /api/users/client-profile` - Get client profile
- `POST /api/users/client-profile` - Create/update client profile
- `GET /api/users/search` - Search users/freelancers
- `GET /api/users/:id` - Get user by ID
- `POST /api/users/wallet/connect` - Connect wallet address
- `GET /api/users/settings` - Get user settings
- `PUT /api/users/settings` - Update user settings

#### Jobs
- `GET /api/jobs` - Get all jobs with filtering
- `POST /api/jobs` - Create new job posting
- `GET /api/jobs/:id` - Get job by ID
- `PUT /api/jobs/:id` - Update job
- `POST /api/jobs/:id/publish` - Publish draft job
- `GET /api/jobs/:id/proposals` - Get job proposals
- `GET /api/jobs/:id/matches` - Get AI-generated matches
- `GET /api/jobs/my-jobs` - Get current user's jobs

#### Proposals
- `GET /api/proposals` - Get proposals with filtering
- `POST /api/proposals` - Submit new proposal
- `GET /api/proposals/:id` - Get proposal by ID
- `PUT /api/proposals/:id` - Update proposal
- `POST /api/proposals/:id/accept` - Accept proposal
- `POST /api/proposals/:id/reject` - Reject proposal
- `GET /api/proposals/my-proposals` - Get user's proposals

#### Smart Contracts
- `POST /api/contracts/create` - Create escrow contract
- `GET /api/contracts/:id` - Get contract details
- `POST /api/contracts/:id/fund` - Fund escrow contract
- `POST /api/contracts/:id/release` - Release funds
- `POST /api/contracts/:id/dispute` - Raise dispute
- `GET /api/contracts/my-contracts` - Get user's contracts

#### Reviews
- `GET /api/reviews` - Get reviews with filtering
- `POST /api/reviews` - Submit new review
- `GET /api/reviews/:id` - Get review by ID
- `PUT /api/reviews/:id` - Update review
- `GET /api/reviews/user/:userId` - Get user's reviews

#### Staking
- `GET /api/staking/positions` - Get staking positions
- `POST /api/staking/stake` - Create staking position
- `POST /api/staking/unstake/:positionId` - Unstake tokens
- `POST /api/staking/claim-rewards/:positionId` - Claim rewards
- `GET /api/staking/rewards` - Get rewards history
- `GET /api/staking/stats` - Get staking statistics
- `POST /api/staking/apy-calculator` - Calculate APY

### GraphQL API

#### Queries
```graphql
# User queries
query {
  me {
    id
    email
    username
    freelancerProfile {
      title
      skills {
        name
        level
      }
      hourlyRate
    }
  }
  
  users(search: "developer", skills: ["React", "Node.js"]) {
    edges {
      node {
        id
        username
        reputation
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}

# Job queries
query {
  jobs(category: WEB_DEVELOPMENT, page: 1, limit: 10) {
    edges {
      node {
        id
        title
        budget
        skills
        client {
          username
          reputation
        }
      }
    }
  }
}

# Staking queries
query {
  stakingPositions {
    id
    amount
    lockPeriod
    currentRewards
    status
  }
}
```

#### Mutations
```graphql
# Update profile
mutation {
  updateFreelancerProfile(input: {
    title: "Full Stack Developer"
    bio: "Experienced developer with 5+ years"
    skills: [
      { name: "React", level: ADVANCED }
      { name: "Node.js", level: EXPERT }
    ]
    hourlyRate: 75
    experienceLevel: SENIOR
  }) {
    id
    title
    profileCompleteness
  }
}

# Create job
mutation {
  createJob(input: {
    title: "Build React Dashboard"
    description: "Need a modern dashboard"
    budget: 5000
    budgetType: FIXED
    category: WEB_DEVELOPMENT
    skills: ["React", "TypeScript"]
  }) {
    id
    title
    status
  }
}

# Submit proposal
mutation {
  submitProposal(input: {
    jobId: "job123"
    bidAmount: 4500
    coverLetter: "I'm perfect for this job"
    deliveryTime: 14
  }) {
    id
    status
    bidAmount
  }
}
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- Redis 6+

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd api-gateway

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=4000

# Database
MONGODB_URI=mongodb://localhost:27017/skillfi
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# External Services
OPENAI_API_KEY=your_openai_key
STRIPE_SECRET_KEY=your_stripe_key
SENDGRID_API_KEY=your_sendgrid_key

# File Upload
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your_s3_bucket

# Frontend
FRONTEND_URL=http://localhost:3000

# Blockchain
INFURA_PROJECT_ID=your_infura_id
PRIVATE_KEY=your_private_key
```

## 🔧 Configuration

### Rate Limiting
```javascript
// Per-user rate limiting
const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each user to 100 requests per windowMs
  keyGenerator: (req) => req.user?.id || req.ip
});
```

### Caching Strategy
```javascript
// Redis caching configuration
const cacheConfig = {
  userProfiles: 300,    // 5 minutes
  jobListings: 60,      // 1 minute
  searchResults: 180,   // 3 minutes
  stakingData: 30       // 30 seconds
};
```

### File Upload
```javascript
// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});
```

## 📊 Monitoring & Analytics

### Health Checks
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "redis": "connected",
    "blockchain": "connected"
  }
}
```

### Metrics Tracking
- Request/response times
- Error rates and types
- User activity patterns
- API endpoint usage
- Database query performance
- Cache hit/miss rates

### Logging
```javascript
// Structured logging with Winston
logger.info('User registered', {
  userId: user.id,
  email: user.email,
  userAgent: req.get('User-Agent'),
  ip: req.ip
});

logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- API key authentication for services
- Wallet signature verification

### Input Validation
```javascript
// Joi validation schemas
const userSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
});
```

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Request size limits
- SQL injection prevention
- XSS protection

### Data Protection
- Password hashing with bcrypt
- Sensitive data encryption
- PII data masking in logs
- Secure file upload validation

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### API Testing
```bash
# Test REST endpoints
npm run test:rest

# Test GraphQL queries
npm run test:graphql
```

### Load Testing
```bash
npm run test:load
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 4000

CMD ["npm", "start"]
```

### Production Configuration
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api-gateway:
    image: skillfi-api-gateway:latest
    environment:
      - NODE_ENV=production
      - PORT=4000
    ports:
      - "4000:4000"
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped
```

### Scaling Considerations
- Horizontal scaling with load balancer
- Database connection pooling
- Redis clustering for cache
- CDN for static assets
- Background job processing

## 📖 API Documentation

### Swagger/OpenAPI
Access interactive API documentation at:
- Development: `http://localhost:4000/docs`
- Production: `https://api.skillfi.io/docs`

### GraphQL Playground
Access GraphQL playground at:
- Development: `http://localhost:4000/graphql`
- Production: `https://api.skillfi.io/graphql`

### Postman Collection
Import the Postman collection for easy API testing:
```bash
# Export collection
npm run docs:postman
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Update documentation
6. Submit pull request

### Code Standards
- ESLint for code quality
- Prettier for formatting
- Conventional commits
- JSDoc for documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Comprehensive API guides
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time community support
- **Email**: api-support@skillfi.io

---

**Built with ❤️ by the SkillFi Team**

*Powering the future of decentralized work*