# SkillFi - Web3 Freelance Marketplace:

A decentralized freelance marketplace built with Next.js, Solidity, and PostgreSQL.

## Why SkillFi? (Real‑world problems we solve)

- **Trust & payment risk**: Funds are locked in smart‑contract escrow rather than a centralized custodian.
- **Opaque dispute resolution**: DAO‑based voting provides auditable, community‑owned outcomes.
- **Fragmented reputation**: Wallet‑tied identity with optional Web2 linking creates portable, verifiable reputation.
- **High platform fees, no voice**: Token holders govern fees, features, and rules on‑chain.
- **Poor matching**: AI matching suggests best client–freelancer fits to reduce search friction.

## How it works (at a glance)

- **On‑chain escrow and disputes**
  - UI: `frontend/components/dashboard/EscrowStatus.tsx`
  - DAO voting for disputes and proposals: `frontend/components/dashboard/GovernanceVoting.tsx`
  - Vote casting: `castVoteWithReason`, dispute voting via `voteOnDispute`
- **Governance & token mechanics**
  - Voting power: token delegation (`delegate`) and `getVotes` via `wagmi`/`viem`
  - Proposal state and tallies read from event logs + multicall
- **Job marketplace**
  - Listings UI: `frontend/components/dashboard/JobListings.tsx`
  - Milestones tied to escrow payouts
- **Auth & identity linking**
  - Wallet + Web2 (email/social) via NextAuth + SIWE, RainbowKit/Wagmi providers
- **AI matching**
  - Service scaffold: `ai-matching-engine/`

## Similar to (but Web3‑native)

- **Upwork / Freelancer.com**: Marketplace workflow (jobs, proposals, milestones)
- **Braintrust / Gitcoin**: Tokenized incentives, on‑chain payouts, DAO governance
- **Aragon / OpenZeppelin Governor UIs**: Governance flows for proposals and voting

## Flowchart (end‑to‑end overview)

```mermaid
flowchart LR
  A[Client posts job] --> B{AI matching}
  B -->|suggests| C[Freelancers apply]
  C --> D[Client selects freelancer]
  D --> E[Escrow funded (smart contract)]
  E --> F[Work & milestones]
  F -->|deliverable accepted| G[Payout released]
  F -->|dispute| H[Dispute raised]
  H --> I[DAO vote (on-chain)]
  I -->|supports client| G
  I -->|supports freelancer| G
  G --> J[Reputation updated (on/off-chain)]
```

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
