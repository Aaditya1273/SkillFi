# SkillFi - Web3 Freelance Marketplace

A decentralized freelance marketplace built with Next.js, Solidity, and PostgreSQL.

## Features

- 🔐 Web3 Authentication (MetaMask, WalletConnect)
- 💼 Project posting and bidding system
- 💰 Escrow smart contracts for secure payments
- 📊 Reputation system on-chain
- 🔍 Advanced search and filtering
- 💬 Real-time messaging
- 📱 Responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **Blockchain**: Solidity, Hardhat, Ethers.js
- **Authentication**: NextAuth.js with Web3 providers

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Fill in your environment variables
   ```

3. **Setup database**
   ```bash
   cd backend && npx prisma migrate dev
   ```

4. **Compile smart contracts**
   ```bash
   npm run compile:contracts
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

## Project Structure

```
SkillFi/
├── frontend/          # Next.js application
├── backend/           # Express API server
├── contracts/         # Solidity smart contracts
├── database/          # Database migrations and seeds
└── docs/             # Documentation
```

## Smart Contracts

- **SkillFiMarketplace**: Main marketplace contract
- **EscrowContract**: Handles secure payments
- **ReputationSystem**: On-chain reputation tracking

## API Endpoints

- `/api/auth/*` - Authentication
- `/api/projects/*` - Project management
- `/api/users/*` - User profiles
- `/api/contracts/*` - Smart contract interactions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License