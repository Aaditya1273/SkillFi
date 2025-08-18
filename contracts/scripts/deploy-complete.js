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
    console.log("\n📄 1/8 Deploying SkillToken...");
    const SkillToken = await hre.ethers.getContractFactory("SkillToken");
    const skillToken = await SkillToken.deploy(deployer.address);
    await skillToken.waitForDeployment();
    contracts.SkillToken = await skillToken.getAddress();
    console.log("✅ SkillToken deployed to:", contracts.SkillToken);

    // 2. Deploy TimelockController
    console.log("\n⏰ 2/8 Deploying TimelockController...");
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
    console.log("\n🏛️ 3/8 Deploying SkillFiDAO...");
    const SkillFiDAO = await hre.ethers.getContractFactory("SkillFiDAO");
    const dao = await SkillFiDAO.deploy(contracts.SkillToken, contracts.TimelockController);
    await dao.waitForDeployment();
    contracts.SkillFiDAO = await dao.getAddress();
    console.log("✅ SkillFiDAO deployed to:", contracts.SkillFiDAO);

    // 4. Deploy SkillFiEscrow
    console.log("\n🔒 4/8 Deploying SkillFiEscrow...");
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
    console.log("\n🥩 5/8 Deploying SkillFiStaking...");
    const SkillFiStaking = await hre.ethers.getContractFactory("SkillFiStaking");
    const staking = await SkillFiStaking.deploy(contracts.SkillToken);
    await staking.waitForDeployment();
    contracts.SkillFiStaking = await staking.getAddress();
    console.log("✅ SkillFiStaking deployed to:", contracts.SkillFiStaking);

    // 6. Deploy SkillFiRewards
    console.log("\n🎁 6/8 Deploying SkillFiRewards...");
    const SkillFiRewards = await hre.ethers.getContractFactory("SkillFiRewards");
    const rewards = await SkillFiRewards.deploy(contracts.SkillToken);
    await rewards.waitForDeployment();
    contracts.SkillFiRewards = await rewards.getAddress();
    console.log("✅ SkillFiRewards deployed to:", contracts.SkillFiRewards);

    // 7. Deploy SkillFiNFT
    console.log("\n🖼️ 7/8 Deploying SkillFiNFT...");
    const SkillFiNFT = await hre.ethers.getContractFactory("SkillFiNFT");
    const nft = await SkillFiNFT.deploy("https://skillfi.io/metadata/");
    await nft.waitForDeployment();
    contracts.SkillFiNFT = await nft.getAddress();
    console.log("✅ SkillFiNFT deployed to:", contracts.SkillFiNFT);

    // 8. Deploy SkillFiInsurance
    console.log("\n🛡️ 8/8 Deploying SkillFiInsurance...");
    const SkillFiInsurance = await hre.ethers.getContractFactory("SkillFiInsurance");
    const insurance = await SkillFiInsurance.deploy(contracts.SkillToken);
    await insurance.waitForDeployment();
    contracts.SkillFiInsurance = await insurance.getAddress();
    console.log("✅ SkillFiInsurance deployed to:", contracts.SkillFiInsurance);

    console.log("\n🔗 Setting up contract connections...");

    // Set marketplace contract in DAO
    await dao.setMarketplaceContract(contracts.SkillFiEscrow);
    console.log("✅ DAO marketplace contract set");

    // Add authorized minters
    await skillToken.addMinter(contracts.SkillFiEscrow);
    await skillToken.addMinter(contracts.SkillFiStaking);
    await skillToken.addMinter(contracts.SkillFiRewards);
    console.log("✅ Authorized minters added");

    // Set platform addresses in token
    await skillToken.setMarketplaceContract(contracts.SkillFiEscrow);
    await skillToken.setStakingContract(contracts.SkillFiStaking);
    console.log("✅ Platform addresses set in token");

    // Add authorized distributors to rewards
    await rewards.addAuthorizedDistributor(contracts.SkillFiEscrow);
    console.log("✅ Escrow added as reward distributor");

    // Add authorized minters to NFT
    await nft.addAuthorizedMinter(contracts.SkillFiEscrow);
    await nft.addAuthorizedMinter(contracts.SkillFiRewards);
    console.log("✅ NFT authorized minters added");

    console.log("\n🧪 Running deployment verification...");

    // Verify token setup
    const tokenSupply = await skillToken.totalSupply();
    console.log("✅ Token total supply:", hre.ethers.formatEther(tokenSupply), "SKILL");

    // Verify DAO setup
    const daoToken = await dao.token();
    console.log("✅ DAO token address matches:", daoToken === contracts.SkillToken);

    // Verify escrow setup
    const escrowToken = await escrow.skillToken();
    const escrowDAO = await escrow.dao();
    console.log("✅ Escrow token matches:", escrowToken === contracts.SkillToken);
    console.log("✅ Escrow DAO matches:", escrowDAO === contracts.SkillFiDAO);

    // Verify staking setup
    const stakingToken = await staking.skillToken();
    console.log("✅ Staking token matches:", stakingToken === contracts.SkillToken);

    // Test reward distribution
    console.log("\n🎯 Testing reward system...");
    await rewards.createSeasonalCampaign(
      "Launch Campaign",
      30 * 24 * 3600, // 30 days
      hre.ethers.parseEther("100000"), // 100k SKILL
      15000 // 1.5x multiplier
    );
    console.log("✅ Test seasonal campaign created");

    // Create deployment summary
    const deploymentInfo = {
      network: hre.network.name,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: contracts,
      settings: {
        tokenSupply: hre.ethers.formatEther(tokenSupply),
        platformFee: "2.5%",
        minStake: "100 SKILL",
        disputeVotingPeriod: "3 days",
        insuranceReserveRatio: "20%",
        loyaltyTiers: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"],
        rewardPools: {
          projectCompletion: "5M SKILL",
          qualityBonus: "2M SKILL",
          referralReward: "1M SKILL",
          loyaltyReward: "3M SKILL",
          communityReward: "1.5M SKILL"
        }
      },
      features: [
        "✅ Escrow with milestone support",
        "✅ DAO governance and dispute resolution",
        "✅ NFT achievements and certifications",
        "✅ Insurance protection",
        "✅ Advanced reward system",
        "✅ Staking with lock multipliers",
        "✅ Anti-scam mechanisms",
        "✅ Reputation system"
      ]
    };

    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("\n" + "=".repeat(60));
    console.log("📋 SKILLFI ECOSYSTEM DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`${name.padEnd(20)} : ${address}`);
    });

    console.log("\n🔧 CONFIGURATION:");
    console.log(`Network                : ${hre.network.name}`);
    console.log(`Deployer              : ${deployer.address}`);
    console.log(`Token Supply          : ${hre.ethers.formatEther(tokenSupply)} SKILL`);
    console.log(`Platform Fee          : 2.5%`);
    console.log(`Min Stake             : 100 SKILL`);

    console.log("\n🚀 FEATURES DEPLOYED:");
    deploymentInfo.features.forEach(feature => console.log(`  ${feature}`));

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

    console.log("\n🔍 VERIFICATION COMMANDS:");
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.log("# Verify contracts on Etherscan:");
      console.log(`npx hardhat verify ${contracts.SkillToken} "${deployer.address}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiDAO} "${contracts.SkillToken}" "${contracts.TimelockController}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiEscrow} "${contracts.SkillToken}" "${contracts.SkillFiDAO}" "${deployer.address}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiStaking} "${contracts.SkillToken}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiRewards} "${contracts.SkillToken}" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiNFT} "https://skillfi.io/metadata/" --network ${hre.network.name}`);
      console.log(`npx hardhat verify ${contracts.SkillFiInsurance} "${contracts.SkillToken}" --network ${hre.network.name}`);
    }

    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Update frontend configuration with contract addresses");
    console.log("2. Update backend API with contract addresses");
    console.log("3. Configure IPFS for NFT metadata");
    console.log("4. Set up monitoring and analytics");
    console.log("5. Conduct security audit");
    console.log("6. Launch testnet beta");

    console.log("\n🌟 SkillFi ecosystem is ready for the future of work!");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment script failed:", error);
    process.exit(1);
  });