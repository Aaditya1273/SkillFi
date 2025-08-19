# SkillFi Smart Contracts

A comprehensive Web3 freelance marketplace ecosystem with advanced DeFi features, DAO governance, and NFT rewards.

## 🏗️ Architecture Overview

```
SkillFi Ecosystem
├── 🪙 SkillToken (SKILL)           - ERC20 governance token
├── 🏛️ SkillFiDAO                  - Decentralized governance & disputes
├── 🔒 SkillFiEscrow               - Core marketplace & escrow system
├── 💰 SkillFiStaking              - Token staking with rewards
├── 🎁 SkillFiRewards              - Loyalty & achievement system
├── 🛡️ SkillFiInsurance            - Decentralized project insurance
└── 🎨 SkillFiNFT                  - Achievement & completion certificates
```

## 📋 Contract Details

### Core Contracts

| Contract | Purpose | Key Features |
|----------|---------|--------------|
| **SkillToken** | Platform currency & governance | ERC20, minting controls, governance voting |
| **SkillFiEscrow** | Marketplace & payments | Project escrow, anti-scam, milestones |
| **SkillFiDAO** | Governance & disputes | OpenZeppelin Governor, dispute resolution |
| **SkillFiStaking** | Token staking | Lock periods, multipliers, voting power |

### Feature Contracts

| Contract | Purpose | Key Features |
|----------|---------|--------------|
| **SkillFiRewards** | Loyalty program | Achievements, referrals, daily rewards |
| **SkillFiInsurance** | Risk protection | Project insurance, claims processing |
| **SkillFiNFT** | Digital certificates | Completion NFTs, skill certifications |

## 🚀 Quick Start

### Prerequisites

```bash
npm install
cp .env.example .env
# Configure your .env file
```

### Local Development

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy-complete.js --network localhost

# Run tests
npx hardhat test

# Test deployment
npx hardhat run scripts/test-complete-deployment.js --network localhost
```

### Testnet Deployment

```bash
# Deploy to Goerli
npx hardhat run scripts/deploy-complete.js --network goerli

# Verify contracts
npx hardhat verify CONTRACT_ADDRESS --network goerli
```

## 🧪 Testing

### Run All Tests
```bash
npx hardhat test
```

### Run Specific Test Suites
```bash
# Core functionality
npx hardhat test test/SkillFiEscrow.test.js

# Complete ecosystem
npx hardhat test test/SkillFiComplete.test.js

# Individual contracts
npx hardhat test --grep "SkillToken"
```

### Coverage Report
```bash
npx hardhat coverage
```

## 📊 Contract Specifications

### SkillToken (SKILL)
- **Type**: ERC20 with governance extensions
- **Supply**: 1B max, 100M initial
- **Minting**: 50M/year cap with role-based access
- **Features**: Voting delegation, pausable transfers

### SkillFiEscrow
- **Anti-Scam**: Minimum stake (100 SKILL), cooldowns, limits
- **Projects**: Full lifecycle management with milestones
- **Payments**: Secure escrow with platform fees (2.5%)
- **Disputes**: Integration with DAO for resolution

### SkillFiDAO
- **Governance**: OpenZeppelin Governor framework
- **Voting**: 3-day periods, 4% quorum requirement
- **Disputes**: Community-driven resolution system
- **Timelock**: 24-hour delay for security

### SkillFiStaking
- **Lock Periods**: 0, 30, 90, 180, 365 days
- **Multipliers**: 1x to 2x based on lock duration
- **Rewards**: Continuous distribution with compounding
- **Voting**: Enhanced power based on stake + lock

### SkillFiRewards
- **Loyalty Tiers**: Bronze → Silver → Gold → Platinum → Diamond
- **Achievements**: 8 different achievement types
- **Referrals**: Reward both referrer and referee
- **Daily Rewards**: Tier-based daily claim system

### SkillFiInsurance
- **Coverage Types**: 5 insurance categories
- **Risk Assessment**: Dynamic premium calculation
- **Claims**: Automated processing with manual review
- **Pools**: Separate pools per insurance type

### SkillFiNFT
- **Types**: Project completion, achievements, skills, milestones
- **Rarity**: 5 tiers (Common → Legendary)
- **Metadata**: On-chain SVG generation
- **Soulbound**: Achievement NFTs are non-transferable

## 💰 Tokenomics

### SKILL Token Distribution
- **Initial Supply**: 100M SKILL
- **Max Supply**: 1B SKILL
- **Yearly Inflation**: Max 5% (50M SKILL)
- **Platform Fee**: 2.5% of project value

### Staking Rewards
- **Base APY**: ~10% (adjustable)
- **Lock Multipliers**: 
  - No lock: 1x
  - 30 days: 1.1x
  - 90 days: 1.25x
  - 180 days: 1.5x
  - 365 days: 2x

### Fee Structure
- **Platform Fee**: 2.5% of project value
- **Insurance Premium**: 3-10% based on risk
- **Staking Rewards**: Minted from yearly allocation

## 🔒 Security Features

### Access Control
- **Role-based permissions** for critical functions
- **Multi-signature** requirements for admin actions
- **Timelock controller** for governance changes

### Anti-Scam Mechanisms
- **Minimum stake** requirement (100 SKILL)
- **Cooldown periods** between actions
- **Project limits** per user (max 5 active)
- **Value limits** for unverified users
- **Reputation system** with on-chain tracking

### Emergency Controls
- **Pausable contracts** for emergency stops
- **Emergency withdrawal** functions
- **Upgrade mechanisms** through governance

## 📈 Gas Optimization

### Storage Efficiency
- **Packed structs** to minimize storage slots
- **Efficient mappings** for user data
- **Batch operations** where possible

### Function Optimization
- **View functions** for read operations
- **Minimal state changes** in transactions
- **Gas-efficient loops** and conditionals

## 🔧 Integration Guide

### Frontend Integration

```javascript
import { ethers } from 'ethers';

// Contract instances
const skillToken = new ethers.Contract(SKILL_TOKEN_ADDRESS, SkillTokenABI, signer);
const escrow = new ethers.Contract(ESCROW_ADDRESS, EscrowABI, signer);

// Create project
async function createProject(title, description, amount, deadline, skills) {
  await skillToken.approve(ESCROW_ADDRESS, amount);
  const tx = await escrow.createProject(title, description, amount, deadline, skills, []);
  return await tx.wait();
}

// Stake tokens
async function stakeTokens(amount, lockPeriod) {
  await skillToken.approve(STAKING_ADDRESS, amount);
  const tx = await staking.stake(amount, lockPeriod);
  return await tx.wait();
}
```

### Backend Integration

```javascript
// Monitor events
escrow.on('ProjectCreated', (projectId, client, title, amount) => {
  console.log(`New project: ${title} by ${client}`);
  // Update database, send notifications
});

escrow.on('ProjectCompleted', (projectId, freelancer, amount) => {
  console.log(`Project ${projectId} completed`);
  // Mint completion NFT, update reputation
});
```

## 📚 Documentation

- **[Smart Contracts Guide](../docs/SMART_CONTRACTS.md)** - Detailed technical documentation
- **[Setup Guide](../docs/SETUP.md)** - Complete setup instructions
- **[API Reference](../docs/API.md)** - Contract function reference
- **[Security Audit](../docs/SECURITY.md)** - Security considerations

## 🧪 Testing Scenarios

### Core Functionality Tests
- ✅ Token minting and transfers
- ✅ Project creation and completion
- ✅ Escrow and payment processing
- ✅ Staking and reward distribution
- ✅ DAO governance and voting
- ✅ Dispute resolution process

### Integration Tests
- ✅ Complete project lifecycle
- ✅ Multi-contract interactions
- ✅ Event emission and handling
- ✅ Error handling and edge cases

### Security Tests
- ✅ Access control verification
- ✅ Reentrancy protection
- ✅ Integer overflow/underflow
- ✅ Emergency pause functionality

## 🚨 Known Issues & Limitations

### Current Limitations
- **Gas costs** can be high for complex operations
- **Scalability** limited by Ethereum throughput
- **Oracle dependency** for external price feeds (future)

### Planned Improvements
- **Layer 2** deployment for lower fees
- **Cross-chain** bridge integration
- **Advanced analytics** and reporting
- **Mobile SDK** for easier integration

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Standards
- **Solidity 0.8.20+** for all contracts
- **OpenZeppelin** libraries for security
- **NatSpec** documentation for all functions
- **100% test coverage** for critical paths

## 📞 Support

### Community
- **Discord**: [SkillFi Community](https://discord.gg/skillfi)
- **Telegram**: [SkillFi Announcements](https://t.me/skillfi)
- **Twitter**: [@SkillFiProtocol](https://twitter.com/skillfiprotocol)

### Technical Support
- **GitHub Issues**: Bug reports and feature requests
- **Documentation**: Comprehensive guides and tutorials
- **Developer Chat**: Real-time support for integrators

### Security
- **Bug Bounty**: Responsible disclosure program
- **Audit Reports**: Professional security audits
- **Emergency Contacts**: 24/7 incident response

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.

---

**Built with ❤️ by the SkillFi Team**

*Empowering the future of decentralized work*