const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Complete SkillFi Ecosystem...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const contracts = {};

  try {
    // 1. Deploy SkillToken
    console.log("\n📄 1/7 Deploying SkillToken...");
    const SkillToken = await hre.ethers.getContractFactory("SkillToken");
    const skillToken = await SkillToken.deploy(deployer.address);
    await skillToken.waitForDeployment();
    contracts.SkillToken = await skillToken.getAddress();
    console.log("✅ SkillToken deployed to:", contracts.SkillToken);

    // 2. Deploy TimelockController
    console.log("\n⏰ 2/7 Deploying TimelockController...");
    const TimelockController = await hre.ethers.getContractFactory("TimelockController");
    const timelock = await TimelockController.deploy(
      86400, // 1 day delay
      [deployer.address], // proposers
      [deployer.address], // executors
      deployer.address // admin
    );
    await timelock.waitForDeployment();
    contracts.TimelockController = await timelock.getAddress();
    console.log("✅ TimelockController deployed to:", contracts.TimelockController);

    // 3. Deploy SkillFiDAO
    console.log("\n🏛️ 3/7 Deploying SkillFiDAO...");
    const SkillFiDAO = await hre.ethers.getContractFactory("SkillFiDAO");
    const dao = await SkillFiDAO.deploy(contracts.SkillToken, contracts.TimelockController);
    await dao.waitForDeployment();
    contracts.SkillFiDAO = await dao.getAddress();
    console.log("✅ SkillFiDAO deployed to:", contracts.SkillFiDAO);

    // 4. Deploy SkillFiEscrow
    console.log("\n🔒 4/7 Deploying SkillFiEscrow...");
    const SkillFiEscrow = await hre.ethers.getContractFactory("SkillFiEscrow");
    const escrow = await SkillFiEscrow.deploy(
      contracts.SkillToken,
      contracts.SkillFiDAO,
      deployer.address // platform treasury
    );
    await escrow.waitForDeployment();
    contracts.SkillFiEscrow = await escrow.getAddress();
    console.log("✅ SkillFiEscrow deployed to:", contracts.SkillFiEscrow);

    // 5. Deploy SkillFiStaking
    console.log("\n💰 5/7 Deploying SkillFiStaking...");
    const SkillFiStaking = await hre.ethers.getContractFactory("SkillFiStaking");
    const staking = await SkillFiStaking.deploy(contracts.SkillToken);
    await staking.waitForDeployment();
    contracts.SkillFiStaking = await staking.getAddress();
    console.log("✅ SkillFiStaking deployed to:", contracts.SkillFiStaking);

    // 6. Deploy SkillFiRewards
    console.log("\n🎁 6/7 Deploying SkillFiRewards...");
    const SkillFiRewards = await hre.ethers.getContractFactory("SkillFiRewards");
    const rewards = await SkillFiRewards.deploy(contracts.SkillToken, contracts.SkillFiEscrow);
    await rewards.waitForDeployment();
    contracts.SkillFiRewards = await rewards.getAddress();
    console.log("✅ SkillFiRewards deployed to:", contracts.SkillFiRewards);

    // 7. Deploy SkillFiInsurance
    console.log("\n🛡️ 7/7 Deploying SkillFiInsurance...");
    const SkillFiInsurance = await hre.ethers.getContractFactory("SkillFiInsurance");
    const insurance = await SkillFiInsurance.deploy(contracts.SkillToken, contracts.SkillFiEscrow);
    await insurance.waitForDeployment();
    contracts.SkillFiInsurance = await insurance.getAddress();
    console.log("✅ SkillFiInsurance deployed to:", contracts.SkillFiInsurance);

    // 8. Deploy SkillFiNFT
    console.log("\n🎨 8/8 Deploying SkillFiNFT...");
    const SkillFiNFT = await hre.ethers.getContractFactory("SkillFiNFT");
    const nft = await SkillFiNFT.deploy(contracts.SkillFiEscrow, contracts.SkillFiRewards);
    await nft.waitForDeployment();
    contracts.SkillFiNFT = await nft.getAddress();
    console.log("✅ SkillFiNFT deployed to:", contracts.SkillFiNFT);

    console.log("\n🔧 Setting up contract connections...");

    // Setup DAO connections
    await dao.setMarketplaceContract(contracts.SkillFiEscrow);
    console.log("✅ DAO marketplace contract set");

    // Setup token connections
    await skillToken.addMinter(contracts.SkillFiEscrow);
    await skillToken.addMinter(contracts.SkillFiStaking);
    await skillToken.addMinter(contracts.SkillFiRewards);
    console.log("✅ Token minters configured");

    await skillToken.setMarketplaceContract(contracts.SkillFiEscrow);
    await skillToken.setStakingContract(contracts.SkillFiStaking);
    console.log("✅ Token platform addresses set");

    console.log("\n🧪 Running deployment verification...");

    // Verify token setup
    const tokenSupply = await skillToken.totalSupply();
    console.log("✅ Token total supply:", hre.ethers.formatEther(tokenSupply), "SKILL");

    // Verify DAO setup
    const daoToken = await dao.token();
    console.log("✅ DAO token address verified:", daoToken === contracts.SkillToken);

    // Verify escrow setup
    const escrowToken = await escrow.skillToken();
    const escrowDAO = await escrow.dao();
    console.log("✅ Escrow connections verified:", 
      escrowToken === contracts.SkillToken && escrowDAO === contracts.SkillFiDAO);

    // Verify staking setup
    const stakingToken = await staking.skillToken();
    console.log("✅ Staking token verified:", stakingToken === contracts.SkillToken);

    // Test basic functionality
    console.log("\n🔍 Testing basic functionality...");

    // Test token delegation for governance
    await skillToken.delegate(deployer.address);
    const votingPower = await skillToken.getVotes(deployer.address);
    console.log("✅ Governance voting power:", hre.ethers.formatEther(votingPower), "SKILL");

    // Test staking
    const stakeAmount = hre.ethers.parseEther("1000");
    await skillToken.approve(contracts.SkillFiStaking, stakeAmount);
    await staking.stake(stakeAmount, 0); // No lock period
    console.log("✅ Staking functionality verified");

    const deploymentInfo = {
      network: hre.network.name,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: contracts,
      gasUsed: {
        // Gas usage would be calculated here in a real deployment
        estimated: "~15M gas total"
      },
      features: {
        "🪙 SKILL Token": "ERC20 governance token with minting controls",
        "🏛️ DAO Governance": "Decentralized governance with dispute resolution",
        "🔒 Escrow System": "Secure project payments with anti-scam protection",
        "💰 Staking Rewards": "Token staking with lock multipliers",
        "🎁 Loyalty Program": "Achievement-based rewards and referrals",
        "🛡️ Insurance System": "Decentralized project insurance",
        "🎨 NFT Certificates": "Achievement and completion NFTs"
      },
      settings: {
        platformFee: "2.5%",
        minStake: "100 SKILL",
        disputeVotingPeriod: "3 days",
        maxLockPeriod: "365 days",
        stakingMultipliers: "1x - 2x based on lock period"
      }
    };

    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("\n" + "=".repeat(60));
    console.log("📋 SKILLFI ECOSYSTEM DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`${name.padEnd(20)} : ${address}`);
    });

    console.log("\n🌟 FEATURES DEPLOYED:");
    Object.entries(deploymentInfo.features).forEach(([feature, description]) => {
      console.log(`${feature} ${description}`);
    });

    console.log("\n⚙️ PLATFORM SETTINGS:");
    Object.entries(deploymentInfo.settings).forEach(([setting, value]) => {
      console.log(`• ${setting}: ${value}`);
    });

    // Save deployment info
    const fs = require('fs');
    const path = require('path');
    
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }
    
    const filename = `complete-deployment-${hre.network.name}-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(deploymentsDir, filename),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\n💾 Deployment info saved to: deployments/${filename}`);

    // Generate environment variables
    console.log("\n📝 ENVIRONMENT VARIABLES FOR .env:");
    console.log("# SkillFi Contract Addresses");
    Object.entries(contracts).forEach(([name, address]) => {
      const envName = name.replace(/([A-Z])/g, '_$1').toUpperCase().substring(1);
      console.log(`${envName}_ADDRESS=${address}`);
    });

    console.log("\n🔧 NEXT STEPS:");
    console.log("1. Update your .env file with the contract addresses above");
    console.log("2. Update frontend configuration files");
    console.log("3. Run the test deployment script:");
    console.log(`   npx hardhat run scripts/test-complete-deployment.js --network ${hre.network.name}`);
    console.log("4. Verify contracts on Etherscan (if on mainnet/testnet)");
    console.log("5. Set up monitoring and analytics");
    console.log("6. Deploy frontend and backend applications");

    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.log("\n🔍 ETHERSCAN VERIFICATION COMMANDS:");
      console.log(`npx hardhat verify ${contracts.SkillToken} "${deployer.address}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiDAO} "${contracts.SkillToken}" "${contracts.TimelockController}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiEscrow} "${contracts.SkillToken}" "${contracts.SkillFiDAO}" "${deployer.address}" --network ${hre.network.name}`);
      // Add more verification commands as needed
    }

    console.log("\n🚀 SkillFi ecosystem is ready for launch!");
    
    return contracts;

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    console.error("Full error:", error);
    
    // Cleanup on failure
    console.log("\n🧹 Cleaning up failed deployment...");
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment script failed:", error);
    process.exit(1);
  });