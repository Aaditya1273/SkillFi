const hre = require("hardhat");

async function main() {
  console.log("Deploying SkillFi Advanced Contracts...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy SkillToken
  console.log("\n1. Deploying SkillToken...");
  const SkillToken = await hre.ethers.getContractFactory("SkillToken");
  const skillToken = await SkillToken.deploy(deployer.address); // Treasury address
  await skillToken.waitForDeployment();
  const skillTokenAddress = await skillToken.getAddress();
  console.log("SkillToken deployed to:", skillTokenAddress);

  // Deploy TimelockController for DAO
  console.log("\n2. Deploying TimelockController...");
  const TimelockController = await hre.ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    86400, // 1 day delay
    [deployer.address], // proposers
    [deployer.address], // executors
    deployer.address // admin
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("TimelockController deployed to:", timelockAddress);

  // Deploy SkillFiDAO
  console.log("\n3. Deploying SkillFiDAO...");
  const SkillFiDAO = await hre.ethers.getContractFactory("SkillFiDAO");
  const dao = await SkillFiDAO.deploy(skillTokenAddress, timelockAddress);
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log("SkillFiDAO deployed to:", daoAddress);

  // Deploy SkillFiEscrow
  console.log("\n4. Deploying SkillFiEscrow...");
  const SkillFiEscrow = await hre.ethers.getContractFactory("SkillFiEscrow");
  const escrow = await SkillFiEscrow.deploy(
    skillTokenAddress,
    daoAddress,
    deployer.address // platform treasury
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("SkillFiEscrow deployed to:", escrowAddress);

  // Setup connections
  console.log("\n5. Setting up contract connections...");
  
  // Set marketplace contract in DAO
  await dao.setMarketplaceContract(escrowAddress);
  console.log("✓ DAO marketplace contract set");

  // Add escrow as minter for rewards (optional)
  await skillToken.addMinter(escrowAddress);
  console.log("✓ Escrow added as token minter");

  // Set platform addresses in token
  await skillToken.setMarketplaceContract(escrowAddress);
  console.log("✓ Token marketplace contract set");

  // Verify deployments
  console.log("\n6. Verifying deployments...");
  
  const tokenSupply = await skillToken.totalSupply();
  console.log("✓ Token total supply:", hre.ethers.formatEther(tokenSupply), "SKILL");
  
  const daoToken = await dao.token();
  console.log("✓ DAO token address:", daoToken);
  
  const escrowToken = await escrow.skillToken();
  console.log("✓ Escrow token address:", escrowToken);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      SkillToken: skillTokenAddress,
      TimelockController: timelockAddress,
      SkillFiDAO: daoAddress,
      SkillFiEscrow: escrowAddress,
    },
    settings: {
      tokenSupply: hre.ethers.formatEther(tokenSupply),
      platformFee: "2.5%",
      minStake: "100 SKILL",
      disputeVotingPeriod: "3 days",
    },
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`\n✓ Deployment info saved to: deployments/${filename}`);

  // Instructions for next steps
  console.log("\n=== NEXT STEPS ===");
  console.log("1. Update your .env file with the contract addresses:");
  console.log(`   SKILL_TOKEN_ADDRESS=${skillTokenAddress}`);
  console.log(`   DAO_ADDRESS=${daoAddress}`);
  console.log(`   ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`   TIMELOCK_ADDRESS=${timelockAddress}`);
  
  console.log("\n2. Verify contracts on Etherscan (if on mainnet/testnet):");
  console.log(`   npx hardhat verify ${skillTokenAddress} "${deployer.address}" --network ${hre.network.name}`);
  console.log(`   npx hardhat verify ${daoAddress} "${skillTokenAddress}" "${timelockAddress}" --network ${hre.network.name}`);
  console.log(`   npx hardhat verify ${escrowAddress} "${skillTokenAddress}" "${daoAddress}" "${deployer.address}" --network ${hre.network.name}`);
  
  console.log("\n3. Update frontend configuration with new addresses");
  console.log("\n4. Test the deployment with the provided test scripts");

  console.log("\n🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });