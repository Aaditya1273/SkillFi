# SkillFi AI Matching Engine

An advanced AI-powered matching engine that uses OpenAI embeddings and machine learning to intelligently match freelancers with client job posts. Built with semantic search, collaborative filtering, and real-time optimization.

## 🚀 Features

### Core Matching Capabilities
- **Semantic Matching** - OpenAI embeddings for deep understanding of job requirements and freelancer skills
- **Multi-Factor Scoring** - Weighted algorithm considering skills, experience, budget, availability, and reputation
- **Real-Time Optimization** - ML-based optimization using historical feedback and performance data
- **Collaborative Filtering** - Recommendations based on similar clients' successful hires
- **Diversity Optimization** - Ensures varied results to prevent skill clustering

### Advanced AI Features
- **Continuous Learning** - Algorithm improves based on user feedback and hiring outcomes
- **Temporal Optimization** - Considers time zones, availability patterns, and recent activity
- **Performance Prediction** - Predicts project success likelihood based on historical data
- **Clustering Analysis** - Groups similar matches for better insights

### Technical Features
- **High Performance** - Redis caching, embedding caching, and optimized queries
- **Scalable Architecture** - Microservices design with queue-based processing
- **Real-Time Updates** - WebSocket integration for live matching updates
- **Comprehensive Analytics** - Detailed matching metrics and performance tracking

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Matching API   │
│   (React/Vue)   │◄──►│   (Express)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             │
                       │     Redis       │◄────────────┤
                       │    (Cache)      │             │
                       └─────────────────┘             │
                                                        │
┌─────────────────┐    ┌─────────────────┐             │
│    OpenAI       │◄──►│   Matching      │◄────────────┤
│   Embeddings    │    │    Engine       │             │
└─────────────────┘    └─────────────────┘             │
                                                        │
                       ┌─────────────────┐             │
                       │    MongoDB      │◄────────────┘
                       │   (Database)    │
                       └─────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- Redis 6+
- OpenAI API Key

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd ai-matching-engine

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (using Docker)
docker-compose up -d mongodb redis

# Run database migrations
npm run migrate

# Generate initial embeddings (optional)
npm run generate-embeddings

# Start development server
npm run dev
```

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/skillfi-matching
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Authentication
JWT_SECRET=your_jwt_secret_here
API_KEYS=service_api_key_1,service_api_key_2

# Frontend
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

## 📚 API Documentation

### Core Endpoints

#### Find Matching Freelancers
```http
POST /api/matching/find-freelancers
Content-Type: application/json
Authorization: Bearer <token>

{
  "jobPostId": "64a7b8c9d1e2f3a4b5c6d7e8",
  "options": {
    "minScore": 0.3,
    "limit": 50,
    "realTime": true,
    "diversityOptimization": true
  }
}
```

**Response:**
```json
{
  "matches": [
    {
      "freelancerId": "64a7b8c9d1e2f3a4b5c6d7e9",
      "freelancer": {
        "id": "64a7b8c9d1e2f3a4b5c6d7e9",
        "name": "John Doe",
        "title": "Full Stack Developer",
        "hourlyRate": 75,
        "reputation": 4.8,
        "skills": ["React", "Node.js", "TypeScript"]
      },
      "score": 0.87,
      "breakdown": {
        "semantic": 0.92,
        "skills": 0.85,
        "experience": 0.90,
        "budget": 0.80,
        "reputation": 0.96
      },
      "reasons": [
        "Strong skill match (85%)",
        "Excellent semantic match for project requirements",
        "Highly rated freelancer (4.8/5)"
      ]
    }
  ],
  "metadata": {
    "processingTime": 1250,
    "totalFreelancers": 1500,
    "matchesFound": 25,
    "averageScore": 0.72
  }
}
```

#### Find Matching Jobs for Freelancer
```http
POST /api/matching/find-jobs
Content-Type: application/json
Authorization: Bearer <token>

{
  "freelancerId": "64a7b8c9d1e2f3a4b5c6d7e9",
  "options": {
    "minScore": 0.4,
    "limit": 20,
    "categories": ["web-development", "blockchain"]
  }
}
```

#### Optimized Matching
```http
POST /api/matching/optimized-matches
Content-Type: application/json
Authorization: Bearer <token>

{
  "jobPostId": "64a7b8c9d1e2f3a4b5c6d7e8",
  "options": {
    "limit": 30,
    "diversityOptimization": true,
    "collaborativeFiltering": true
  }
}
```

#### Batch Matching
```http
POST /api/matching/batch-match
Content-Type: application/json
Authorization: Bearer <token>

{
  "jobPostIds": [
    "64a7b8c9d1e2f3a4b5c6d7e8",
    "64a7b8c9d1e2f3a4b5c6d7e9"
  ],
  "options": {
    "parallel": true,
    "limit": 20
  }
}
```

### Analytics Endpoints

#### Matching Statistics
```http
GET /api/matching/stats/64a7b8c9d1e2f3a4b5c6d7e8
Authorization: Bearer <token>
```

#### Update Algorithm Weights
```http
POST /api/matching/update-weights
Content-Type: application/json
Authorization: Bearer <token>

{
  "weights": {
    "semantic": 0.40,
    "skills": 0.30,
    "experience": 0.15,
    "budget": 0.10,
    "reputation": 0.05
  }
}
```

## 🧠 Matching Algorithm

### Scoring Components

The matching algorithm uses a weighted combination of multiple factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Semantic** | 35% | OpenAI embedding similarity between job description and freelancer profile |
| **Skills** | 25% | Exact and partial skill matching with fuzzy string matching |
| **Experience** | 15% | Experience level compatibility |
| **Budget** | 10% | Budget and hourly rate compatibility |
| **Availability** | 5% | Timeline and availability matching |
| **Reputation** | 5% | Freelancer rating and review history |
| **Location** | 3% | Geographic and timezone preferences |
| **Past Success** | 2% | Historical collaboration success rate |

### Optimization Techniques

1. **Feedback Learning** - Algorithm learns from user interactions and hiring outcomes
2. **Collaborative Filtering** - Uses similar clients' successful hires for recommendations
3. **Diversity Optimization** - Prevents over-clustering of similar skill sets
4. **Temporal Factors** - Considers time zones, recent activity, and availability patterns
5. **Performance Adjustment** - Adjusts scores based on freelancer's historical performance

### Embedding Generation

```javascript
// Job post embedding
const jobText = `${title}. ${description}. Required skills: ${skills.join(', ')}. 
                Experience level: ${experienceLevel}. Budget: $${budget}`;

// Freelancer embedding  
const freelancerText = `${title}. ${bio}. Skills: ${skills.join(', ')}. 
                       Experience: ${experienceLevel}. Rate: $${hourlyRate}`;

const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text
});
```

## 🔧 Configuration

### Matching Weights
Customize the importance of different matching factors:

```javascript
const weights = {
  semantic: 0.35,        // Semantic similarity
  skills: 0.25,          // Skill matching
  experience: 0.15,      // Experience compatibility
  budget: 0.10,          // Budget alignment
  availability: 0.05,    // Timeline matching
  reputation: 0.05,      // Freelancer reputation
  location: 0.03,        // Location preference
  pastSuccess: 0.02      // Historical success
};
```

### Cache Configuration
```javascript
const cacheConfig = {
  embeddingTTL: 24 * 60 * 60, // 24 hours
  matchingTTL: 30 * 60,       // 30 minutes
  analyticsTTL: 60 * 60       // 1 hour
};
```

### Performance Tuning
```javascript
const performanceConfig = {
  maxFreelancers: 1000,       // Max freelancers to consider
  batchSize: 100,             // Embedding batch size
  concurrentRequests: 5,      // Max concurrent OpenAI requests
  cacheSize: 10000           // Max cached embeddings
};
```

## 📊 Monitoring & Analytics

### Key Metrics
- **Matching Accuracy** - Percentage of matches that result in successful hires
- **Response Time** - Average time to generate matches
- **Cache Hit Rate** - Percentage of requests served from cache
- **User Satisfaction** - Feedback scores and ratings

### Performance Monitoring
```javascript
// Built-in performance tracking
logger.performance('Matching completed', {
  processingTime: 1250,
  matchesFound: 25,
  cacheHitRate: 0.85
});
```

### Health Checks
```http
GET /api/matching/health
```

Response:
```json
{
  "status": "healthy",
  "services": {
    "openai": "healthy",
    "redis": "healthy",
    "database": "healthy"
  },
  "cache": {
    "embeddingCacheSize": 5420,
    "redisCacheKeys": 12500
  }
}
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Coverage report
npm run test:coverage
```

### Benchmark Performance
```bash
# Run matching benchmarks
npm run benchmark

# Load testing
npm run test:load
```

### Example Test
```javascript
describe('Matching Engine', () => {
  it('should find relevant matches', async () => {
    const matches = await matchingEngine.findMatches(jobPostId, {
      minScore: 0.5,
      limit: 10
    });
    
    expect(matches.matches).to.have.length.greaterThan(0);
    expect(matches.matches[0].score).to.be.greaterThan(0.5);
    expect(matches.metadata.processingTime).to.be.lessThan(5000);
  });
});
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t skillfi-matching-engine .

# Run with docker-compose
docker-compose up -d
```

### Production Configuration
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  matching-engine:
    image: skillfi-matching-engine:latest
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/skillfi
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped
```

### Scaling
- **Horizontal Scaling** - Deploy multiple instances behind a load balancer
- **Caching Strategy** - Use Redis cluster for distributed caching
- **Database Optimization** - MongoDB sharding for large datasets
- **Queue Processing** - Bull queues for background processing

## 🔒 Security

### Authentication
- JWT token-based authentication
- API key authentication for service-to-service communication
- Role-based access control (RBAC)

### Rate Limiting
```javascript
// Per-user rate limiting
app.use('/api/matching', userRateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
```

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

## 🤝 Contributing

### Development Setup
```bash
# Fork and clone repository
git clone <your-fork-url>
cd ai-matching-engine

# Install dependencies
npm install

# Set up pre-commit hooks
npm run prepare

# Run in development mode
npm run dev
```

### Code Standards
- ESLint configuration for code quality
- Prettier for code formatting
- Jest for testing
- Conventional commits for commit messages

### Pull Request Process
1. Create feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass
4. Update documentation
5. Submit pull request with detailed description

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation** - Comprehensive API and integration guides
- **GitHub Issues** - Bug reports and feature requests
- **Discord Community** - Real-time support and discussions
- **Email Support** - technical-support@skillfi.io

---

**Built with ❤️ by the SkillFi Team**

*Revolutionizing freelance matching with AI*