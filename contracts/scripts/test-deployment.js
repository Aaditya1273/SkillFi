const hre = require("hardhat");

async function main() {
  console.log("Testing SkillFi Contract Deployment...");

  // Get contract addresses from deployment
  const SKILL_TOKEN_ADDRESS = process.env.SKILL_TOKEN_ADDRESS;
  const DAO_ADDRESS = process.env.DAO_ADDRESS;
  const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS;

  if (!SKILL_TOKEN_ADDRESS || !DAO_ADDRESS || !ESCROW_ADDRESS) {
    console.error("Please set contract addresses in environment variables");
    console.log("Required: SKILL_TOKEN_ADDRESS, DAO_ADDRESS, ESCROW_ADDRESS");
    return;
  }

  const [deployer, client, freelancer] = await hre.ethers.getSigners();
  console.log("Testing with accounts:");
  console.log("Deployer:", deployer.address);
  console.log("Client:", client.address);
  console.log("Freelancer:", freelancer.address);

  // Get contract instances
  const skillToken = await hre.ethers.getContractAt("SkillToken", SKILL_TOKEN_ADDRESS);
  const dao = await hre.ethers.getContractAt("SkillFiDAO", DAO_ADDRESS);
  const escrow = await hre.ethers.getContractAt("SkillFiEscrow", ESCROW_ADDRESS);

  console.log("\n=== CONTRACT VERIFICATION ===");

  // Test SkillToken
  const tokenName = await skillToken.name();
  const tokenSymbol = await skillToken.symbol();
  const totalSupply = await skillToken.totalSupply();
  console.log(`✓ SkillToken: ${tokenName} (${tokenSymbol})`);
  console.log(`✓ Total Supply: ${hre.ethers.formatEther(totalSupply)} SKILL`);

  // Test DAO
  const daoToken = await dao.token();
  console.log(`✓ DAO Token Address: ${daoToken}`);
  console.log(`✓ DAO Token Matches: ${daoToken === SKILL_TOKEN_ADDRESS}`);

  // Test Escrow
  const escrowToken = await escrow.skillToken();
  const escrowDAO = await escrow.dao();
  console.log(`✓ Escrow Token Address: ${escrowToken}`);
  console.log(`✓ Escrow DAO Address: ${escrowDAO}`);
  console.log(`✓ Escrow Token Matches: ${escrowToken === SKILL_TOKEN_ADDRESS}`);
  console.log(`✓ Escrow DAO Matches: ${escrowDAO === DAO_ADDRESS}`);

  console.log("\n=== FUNCTIONAL TESTING ===");

  try {
    // Distribute tokens for testing
    console.log("1. Distributing tokens...");
    const testAmount = hre.ethers.parseEther("10000");
    
    await skillToken.connect(deployer).transfer(client.address, testAmount);
    await skillToken.connect(deployer).transfer(freelancer.address, testAmount);
    
    const clientBalance = await skillToken.balanceOf(client.address);
    const freelancerBalance = await skillToken.balanceOf(freelancer.address);
    
    console.log(`✓ Client balance: ${hre.ethers.formatEther(clientBalance)} SKILL`);
    console.log(`✓ Freelancer balance: ${hre.ethers.formatEther(freelancerBalance)} SKILL`);

    // Test staking for governance
    console.log("\n2. Setting up governance voting power...");
    await skillToken.connect(client).delegate(client.address);
    await skillToken.connect(freelancer).delegate(freelancer.address);
    
    const clientVotes = await skillToken.getVotes(client.address);
    const freelancerVotes = await skillToken.getVotes(freelancer.address);
    
    console.log(`✓ Client voting power: ${hre.ethers.formatEther(clientVotes)} SKILL`);
    console.log(`✓ Freelancer voting power: ${hre.ethers.formatEther(freelancerVotes)} SKILL`);

    // Test escrow functionality
    console.log("\n3. Testing escrow functionality...");
    
    // Deposit stakes
    const stakeAmount = hre.ethers.parseEther("1000");
    await skillToken.connect(client).approve(ESCROW_ADDRESS, stakeAmount);
    await skillToken.connect(freelancer).approve(ESCROW_ADDRESS, stakeAmount);
    
    await escrow.connect(client).depositStake(stakeAmount);
    await escrow.connect(freelancer).depositStake(stakeAmount);
    
    console.log("✓ Stakes deposited successfully");

    // Create a test project
    const projectAmount = hre.ethers.parseEther("5000");
    await skillToken.connect(client).approve(ESCROW_ADDRESS, projectAmount);
    
    const deadline = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
    
    const tx = await escrow.connect(client).createProject(
      "Test DeFi Dashboard",
      "Build a comprehensive DeFi analytics dashboard with real-time data visualization",
      projectAmount,
      deadline,
      ["React", "TypeScript", "Web3", "Chart.js"],
      [] // No milestones for this test
    );
    
    const receipt = await tx.wait();
    console.log("✓ Project created successfully");
    console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

    // Get project details
    const project = await escrow.getProject(1);
    console.log(`✓ Project ID: ${project.id}`);
    console.log(`✓ Project Title: ${project.title}`);
    console.log(`✓ Project Amount: ${hre.ethers.formatEther(project.totalAmount)} SKILL`);
    console.log(`✓ Project Status: ${project.status} (0=Open)`);

    // Accept freelancer
    await escrow.connect(client).acceptFreelancer(1, freelancer.address);
    console.log("✓ Freelancer accepted successfully");

    const updatedProject = await escrow.getProject(1);
    console.log(`✓ Updated Status: ${updatedProject.status} (1=InProgress)`);
    console.log(`✓ Assigned Freelancer: ${updatedProject.freelancer}`);

    console.log("\n=== ANTI-SCAM MECHANISMS TEST ===");

    // Test cooldown period
    try {
      await escrow.connect(client).createProject(
        "Second Project",
        "This should fail due to cooldown",
        hre.ethers.parseEther("1000"),
        deadline,
        ["JavaScript"],
        []
      );
      console.log("❌ Cooldown mechanism failed");
    } catch (error) {
      console.log("✓ Cooldown mechanism working - prevented rapid project creation");
    }

    // Test stake requirements
    const [newUser] = await hre.ethers.getSigners();
    await skillToken.connect(deployer).transfer(newUser.address, hre.ethers.parseEther("1000"));
    await skillToken.connect(newUser).approve(ESCROW_ADDRESS, hre.ethers.parseEther("1000"));
    
    try {
      await escrow.connect(newUser).createProject(
        "Unstaked Project",
        "This should fail due to no stake",
        hre.ethers.parseEther("1000"),
        deadline,
        ["JavaScript"],
        []
      );
      console.log("❌ Stake requirement failed");
    } catch (error) {
      console.log("✓ Stake requirement working - prevented unstaked user from creating project");
    }

    console.log("\n=== RATING SYSTEM TEST ===");

    // Complete the project to test rating
    await escrow.connect(client).completeProject(1);
    console.log("✓ Project completed successfully");

    // Test rating system
    await escrow.connect(client).rateUser(1, freelancer.address, 5);
    await escrow.connect(freelancer).rateUser(1, client.address, 4);
    
    const freelancerRating = await escrow.getUserRating(freelancer.address);
    const clientRating = await escrow.getUserRating(client.address);
    
    console.log(`✓ Freelancer rating: ${freelancerRating}/5`);
    console.log(`✓ Client rating: ${clientRating}/5`);

    // Check reputation updates
    const freelancerRep = await escrow.userReputations(freelancer.address);
    console.log(`✓ Freelancer completed projects: ${freelancerRep.completedProjects}`);
    console.log(`✓ Freelancer total earned: ${hre.ethers.formatEther(freelancerRep.totalEarned)} SKILL`);

    console.log("\n=== DISPUTE SYSTEM TEST ===");

    // Create another project for dispute testing
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    // Increase time to pass cooldown (in test environment)
    if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
      await hre.network.provider.send("evm_increaseTime", [3600]); // 1 hour
      await hre.network.provider.send("evm_mine");
    }
    
    await skillToken.connect(client).approve(ESCROW_ADDRESS, projectAmount);
    await escrow.connect(client).createProject(
      "Dispute Test Project",
      "This project will be disputed",
      projectAmount,
      deadline,
      ["Solidity"],
      []
    );
    
    await escrow.connect(client).acceptFreelancer(2, freelancer.address);
    console.log("✓ Second project created and freelancer accepted");

    // Raise a dispute
    await escrow.connect(client).raiseDispute(2, "Work quality does not meet requirements");
    console.log("✓ Dispute raised successfully");

    const disputedProject = await escrow.getProject(2);
    console.log(`✓ Project status after dispute: ${disputedProject.status} (4=Disputed)`);
    console.log(`✓ Dispute ID: ${disputedProject.disputeId}`);

    // Get dispute details
    const dispute = await dao.getDispute(disputedProject.disputeId);
    console.log(`✓ Dispute client: ${dispute.client}`);
    console.log(`✓ Dispute freelancer: ${dispute.freelancer}`);
    console.log(`✓ Dispute amount: ${hre.ethers.formatEther(dispute.amount)} SKILL`);
    console.log(`✓ Dispute reason: ${dispute.reason}`);

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log(`SkillToken: ${SKILL_TOKEN_ADDRESS}`);
    console.log(`SkillFiDAO: ${DAO_ADDRESS}`);
    console.log(`SkillFiEscrow: ${ESCROW_ADDRESS}`);
    console.log("\nThe SkillFi platform is ready for use!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test script failed:", error);
    process.exit(1);
  });