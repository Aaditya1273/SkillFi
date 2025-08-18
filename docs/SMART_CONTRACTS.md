# SkillFi Smart Contracts Documentation

## Overview

SkillFi's smart contract system provides a comprehensive Web3 freelance marketplace with advanced features including escrow payments, DAO governance, anti-scam mechanisms, and token-based incentives.

## Contract Architecture

### Core Contracts

1. **SkillToken.sol** - ERC20 governance token
2. **SkillFiEscrow.sol** - Main marketplace and escrow system
3. **SkillFiDAO.sol** - Decentralized governance and dispute resolution
4. **SkillFiStaking.sol** - Token staking with voting power and rewards

## Contract Details

### 1. SkillToken (SKILL)

**Purpose**: Native platform token with governance capabilities

**Key Features**:
- ERC20 token with 1 billion max supply
- Yearly minting cap of 50 million tokens (5% of max supply)
- Pausable transfers for emergency situations
- Permit functionality for gasless approvals
- Minter role management

**Important Functions**:
```solidity
function mint(address to, uint256 amount) external onlyMinter
function addMinter(address minter) external onlyOwner
function delegate(address delegatee) external // For governance voting
```

**Token Economics**:
- Initial Supply: 100 million SKILL
- Max Supply: 1 billion SKILL
- Yearly Mint Cap: 50 million SKILL
- Platform Fee: 2.5% of project value

### 2. SkillFiEscrow

**Purpose**: Core marketplace with secure escrow and anti-scam features

**Key Features**:
- Secure escrow for project payments
- Milestone-based project management
- Anti-scam mechanisms (staking, cooldowns, limits)
- Reputation and rating system
- Integration with DAO for dispute resolution

**Project Lifecycle**:
1. **Open** - Accepting proposals
2. **InProgress** - Work in progress
3. **Submitted** - Work submitted for review
4. **Completed** - Project completed and paid
5. **Disputed** - In dispute resolution
6. **Cancelled** - Project cancelled

**Anti-Scam Mechanisms**:
- **Minimum Stake**: 100 SKILL tokens required to participate
- **Cooldown Period**: 1 hour between project creations
- **Project Limits**: Max 5 active projects per user
- **Value Limits**: 10,000 SKILL max for unverified users
- **Verification System**: Manual verification for higher limits

**Important Functions**:
```solidity
function createProject(
    string memory title,
    string memory description,
    uint256 amount,
    uint256 deadline,
    string[] memory skills,
    Milestone[] memory milestones
) external

function acceptFreelancer(uint256 projectId, address freelancer) external
function completeProject(uint256 projectId) external
function completeMilestone(uint256 projectId, uint256 milestoneIndex) external
function raiseDispute(uint256 projectId, string memory reason) external
function rateUser(uint256 projectId, address target, uint256 rating) external
```

### 3. SkillFiDAO

**Purpose**: Decentralized governance and dispute resolution

**Key Features**:
- OpenZeppelin Governor-based governance
- Dispute resolution voting system
- Timelock controller for security
- Quorum-based decision making (4% of total supply)
- 3-day voting period for disputes

**Dispute Resolution Process**:
1. Dispute raised in escrow contract
2. DAO creates dispute with 3-day voting period
3. Token holders vote (minimum 1000 SKILL required)
4. Dispute resolved based on vote outcome
5. Funds distributed according to decision

**Important Functions**:
```solidity
function createDispute(
    uint256 projectId,
    address client,
    address freelancer,
    uint256 amount,
    string memory reason
) external returns (uint256)

function voteOnDispute(uint256 disputeId, bool supportsClient) external
function resolveDispute(uint256 disputeId) external
```

### 4. SkillFiStaking

**Purpose**: Token staking with governance voting power and rewards

**Key Features**:
- Flexible lock periods (0, 30, 90, 180, 365 days)
- Lock multipliers for increased rewards and voting power
- Continuous reward distribution
- Governance voting power based on staked amount and lock period

**Lock Multipliers**:
- No lock: 1x rewards and voting power
- 30 days: 1.1x multiplier
- 90 days: 1.25x multiplier
- 180 days: 1.5x multiplier
- 365 days: 2x multiplier

**Important Functions**:
```solidity
function stake(uint256 amount, uint256 lockPeriod) external
function unstake(uint256 amount) external
function claimReward() external
function getVotingPower(address account) external view returns (uint256)
```

## Security Features

### 1. Access Control
- Owner-only functions for critical operations
- Role-based permissions (minters, governance)
- Multi-signature timelock for governance actions

### 2. Reentrancy Protection
- ReentrancyGuard on all state-changing functions
- Checks-Effects-Interactions pattern

### 3. Emergency Controls
- Pausable contracts for emergency stops
- Emergency withdrawal functions
- Upgrade mechanisms through governance

### 4. Input Validation
- Comprehensive parameter validation
- Overflow/underflow protection with Solidity 0.8+
- Address validation and zero-address checks

## Gas Optimization

### 1. Storage Optimization
- Packed structs to minimize storage slots
- Efficient mapping usage
- Minimal state variable updates

### 2. Function Optimization
- View functions for read operations
- Batch operations where possible
- Efficient loops and conditionals

## Deployment Guide

### Prerequisites
```bash
npm install
cp .env.example .env
# Configure your .env file
```

### Local Deployment
```bash
# Start local blockchain
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy-advanced.js --network localhost

# Test deployment
npx hardhat run scripts/test-deployment.js --network localhost
```

### Testnet Deployment
```bash
# Deploy to Goerli
npx hardhat run scripts/deploy-advanced.js --network goerli

# Verify contracts
npx hardhat verify CONTRACT_ADDRESS --network goerli
```

### Mainnet Deployment
```bash
# Deploy to mainnet (ensure sufficient ETH for gas)
npx hardhat run scripts/deploy-advanced.js --network mainnet

# Verify all contracts
npx hardhat verify SKILL_TOKEN_ADDRESS "TREASURY_ADDRESS" --network mainnet
npx hardhat verify DAO_ADDRESS "SKILL_TOKEN_ADDRESS" "TIMELOCK_ADDRESS" --network mainnet
npx hardhat verify ESCROW_ADDRESS "SKILL_TOKEN_ADDRESS" "DAO_ADDRESS" "TREASURY_ADDRESS" --network mainnet
```

## Integration Guide

### Frontend Integration

```javascript
import { ethers } from 'ethers';
import SkillTokenABI from './abis/SkillToken.json';
import SkillFiEscrowABI from './abis/SkillFiEscrow.json';

// Contract instances
const skillToken = new ethers.Contract(SKILL_TOKEN_ADDRESS, SkillTokenABI, signer);
const escrow = new ethers.Contract(ESCROW_ADDRESS, SkillFiEscrowABI, signer);

// Create project
async function createProject(title, description, amount, deadline, skills) {
  // Approve tokens
  await skillToken.approve(ESCROW_ADDRESS, amount);
  
  // Create project
  const tx = await escrow.createProject(title, description, amount, deadline, skills, []);
  return await tx.wait();
}

// Get user reputation
async function getUserReputation(address) {
  const reputation = await escrow.userReputations(address);
  const rating = await escrow.getUserRating(address);
  
  return {
    totalEarned: ethers.formatEther(reputation.totalEarned),
    completedProjects: reputation.completedProjects.toString(),
    averageRating: rating.toString(),
    isVerified: reputation.isVerified
  };
}
```

### Backend Integration

```javascript
// Monitor contract events
const escrow = new ethers.Contract(ESCROW_ADDRESS, SkillFiEscrowABI, provider);

escrow.on('ProjectCreated', (projectId, client, title, amount, hasMilestones) => {
  console.log(`New project created: ${title} by ${client}`);
  // Update database, send notifications, etc.
});

escrow.on('DisputeRaised', (projectId, initiator, disputeId) => {
  console.log(`Dispute raised for project ${projectId}`);
  // Notify DAO members, update UI, etc.
});
```

## Testing

### Unit Tests
```bash
npx hardhat test
```

### Integration Tests
```bash
npx hardhat run scripts/test-deployment.js --network localhost
```

### Coverage Report
```bash
npx hardhat coverage
```

## Monitoring and Analytics

### Key Metrics to Track
- Total Value Locked (TVL) in escrow
- Number of active projects
- Dispute resolution success rate
- Token distribution and staking metrics
- Platform fee collection

### Event Monitoring
- Project lifecycle events
- Dispute creation and resolution
- Token transfers and staking
- Governance proposals and votes

## Upgrade Strategy

### Governance-Controlled Upgrades
1. Propose upgrade through DAO
2. Community voting period
3. Timelock execution
4. Contract upgrade deployment

### Emergency Procedures
1. Pause contracts if critical vulnerability found
2. Emergency DAO vote for immediate action
3. Coordinate with community for resolution
4. Resume operations after fix

## Security Considerations

### Audit Recommendations
1. Professional smart contract audit before mainnet
2. Bug bounty program for ongoing security
3. Regular security reviews and updates
4. Community-driven security monitoring

### Best Practices
1. Multi-signature wallets for admin functions
2. Gradual rollout with usage limits
3. Comprehensive testing on testnets
4. Emergency response procedures

## Support and Resources

### Documentation
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Ethereum Development](https://ethereum.org/developers)

### Community
- Discord: [SkillFi Community]
- GitHub: [SkillFi Repository]
- Forum: [SkillFi Governance]

### Contact
- Technical Support: tech@skillfi.io
- Security Issues: security@skillfi.io
- General Inquiries: hello@skillfi.io