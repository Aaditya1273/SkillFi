# SkillFi Setup Guide

This guide will help you set up the SkillFi Web3 freelance marketplace locally.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Git
- MetaMask or another Web3 wallet

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd SkillFi
npm install
```

### 2. Environment Setup

Copy the environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://skillfi_user:skillfi_password@localhost:5432/skillfi"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Blockchain
PRIVATE_KEY="your-private-key-for-deployment"
INFURA_PROJECT_ID="your-infura-project-id"
ETHERSCAN_API_KEY="your-etherscan-api-key"

# API
API_URL="http://localhost:8000"
JWT_SECRET="your-jwt-secret-here"

# IPFS (Optional)
PINATA_API_KEY="your-pinata-api-key"
PINATA_SECRET_API_KEY="your-pinata-secret-key"
```

### 3. Database Setup

#### Option A: Using Docker (Recommended)

```bash
cd database
docker-compose up -d
```

#### Option B: Local PostgreSQL

1. Install PostgreSQL
2. Create database and user:

```sql
CREATE DATABASE skillfi;
CREATE USER skillfi_user WITH PASSWORD 'skillfi_password';
GRANT ALL PRIVILEGES ON DATABASE skillfi TO skillfi_user;
```

### 4. Run Database Migrations

```bash
cd backend
npm run db:generate
npm run db:migrate
```

### 5. Compile Smart Contracts

```bash
npm run compile:contracts
```

### 6. Start Development Servers

```bash
# Start all services
npm run dev

# Or start individually
npm run dev:frontend  # Frontend on :3000
npm run dev:backend   # Backend on :8000
```

## Detailed Setup

### Frontend Setup

The frontend is a Next.js 14 application with:
- TypeScript
- Tailwind CSS
- RainbowKit for Web3 integration
- NextAuth.js for authentication

```bash
cd frontend
npm install
npm run dev
```

### Backend Setup

The backend is an Express.js API with:
- Prisma ORM
- PostgreSQL database
- JWT authentication
- Socket.IO for real-time messaging

```bash
cd backend
npm install
npm run dev
```

### Smart Contracts Setup

Smart contracts are built with Hardhat:

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

#### Deploy to Local Network

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts (in another terminal)
npx hardhat run scripts/deploy.js --network localhost
```

#### Deploy to Testnet

```bash
npx hardhat run scripts/deploy.js --network goerli
```

## Configuration

### Web3 Configuration

1. Install MetaMask browser extension
2. Add local network (if using Hardhat):
   - Network Name: Localhost 8545
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH

### Database Schema

The application uses the following main entities:
- Users (clients and freelancers)
- Projects
- Proposals
- Messages
- Reviews

### API Endpoints

- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/users` - List freelancers
- `POST /api/proposals` - Submit proposal
- `GET /api/messages` - Get messages

## Testing

### Run Tests

```bash
# Smart contract tests
cd contracts && npm test

# Backend tests (if implemented)
cd backend && npm test

# Frontend tests (if implemented)
cd frontend && npm test
```

### Manual Testing

1. Register as a client and freelancer (use different browsers/incognito)
2. Create a project as client
3. Submit proposal as freelancer
4. Accept proposal as client
5. Test messaging system
6. Complete project and verify payment

## Deployment

### Frontend (Vercel)

```bash
cd frontend
npm run build
# Deploy to Vercel
```

### Backend (Railway/Heroku)

```bash
cd backend
# Set environment variables
# Deploy to your preferred platform
```

### Smart Contracts (Mainnet)

```bash
cd contracts
npx hardhat run scripts/deploy.js --network mainnet
npx hardhat verify CONTRACT_ADDRESS --network mainnet
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify DATABASE_URL in .env

2. **Web3 Connection Issues**
   - Ensure MetaMask is installed and connected
   - Check network configuration

3. **Smart Contract Deployment Fails**
   - Verify you have enough ETH for gas
   - Check private key and network settings

4. **Frontend Build Errors**
   - Clear node_modules and reinstall
   - Check TypeScript errors

### Getting Help

- Check the GitHub issues
- Review the documentation
- Join our Discord community

## Next Steps

After setup:
1. Customize the UI/UX
2. Add more smart contract features
3. Implement additional payment methods
4. Add more comprehensive testing
5. Set up CI/CD pipeline