const hre = require("hardhat");

async function main() {
  console.log("Deploying SkillFi contracts...");

  // Deploy SkillFiMarketplace
  const SkillFiMarketplace = await hre.ethers.getContractFactory("SkillFiMarketplace");
  const marketplace = await SkillFiMarketplace.deploy();
  await marketplace.waitForDeployment();

  console.log("SkillFiMarketplace deployed to:", await marketplace.getAddress());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contracts: {
      SkillFiMarketplace: await marketplace.getAddress(),
    },
    timestamp: new Date().toISOString(),
  };

  console.log("Deployment completed:", deploymentInfo);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });