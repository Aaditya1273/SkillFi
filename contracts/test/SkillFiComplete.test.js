const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SkillFi Complete Ecosystem", function () {
  let skillToken, dao, escrow, staking, rewards, insurance, nft, timelock;
  let owner, client, freelancer, voter1, voter2, treasury;
  let contracts = {};

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100M tokens
  const STAKE_AMOUNT = ethers.parseEther("1000"); // 1000 SKILL tokens
  const PROJECT_AMOUNT = ethers.parseEther("5000"); // 5000 SKILL tokens

  beforeEach(async function () {
    [owner, client, freelancer, voter1, voter2, treasury] = await ethers.getSigners();
    
    // Deploy all contracts
    await deployCompleteEcosystem();
    
    // Setup initial state
    await setupInitialState();
  });

  async function deployCompleteEcosystem() {
    console.log("Deploying complete SkillFi ecosystem...");

    // 1. Deploy SkillToken
    const SkillToken = await ethers.getContractFactory("SkillToken");
    skillToken = await SkillToken.deploy(treasury.address);
    await skillToken.waitForDeployment();
    contracts.skillToken = await skillToken.getAddress();

    // 2. Deploy TimelockController
    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(
      86400, // 1 day delay
      [owner.address], // proposers
      [owner.address], // executors
      owner.address // admin
    );
    await timelock.waitForDeployment();
    contracts.timelock = await timelock.getAddress();

    // 3. Deploy SkillFiDAO
    const SkillFiDAO = await ethers.getContractFactory("SkillFiDAO");
    dao = await SkillFiDAO.deploy(contracts.skillToken, contracts.timelock);
    await dao.waitForDeployment();
    contracts.dao = await dao.getAddress();

    // 4. Deploy SkillFiEscrow
    const SkillFiEscrow = await ethers.getContractFactory("SkillFiEscrow");
    escrow = await SkillFiEscrow.deploy(
      contracts.skillToken,
      contracts.dao,
      treasury.address
    );
    await escrow.waitForDeployment();
    contracts.escrow = await escrow.getAddress();

    // 5. Deploy SkillFiStaking
    const SkillFiStaking = await ethers.getContractFactory("SkillFiStaking");
    staking = await SkillFiStaking.deploy(contracts.skillToken);
    await staking.waitForDeployment();
    contracts.staking = await staking.getAddress();

    // 6. Deploy SkillFiRewards
    const SkillFiRewards = await ethers.getContractFactory("SkillFiRewards");
    rewards = await SkillFiRewards.deploy(contracts.skillToken, contracts.escrow);
    await rewards.waitForDeployment();
    contracts.rewards = await rewards.getAddress();

    // 7. Deploy SkillFiInsurance
    const SkillFiInsurance = await ethers.getContractFactory("SkillFiInsurance");
    insurance = await SkillFiInsurance.deploy(contracts.skillToken, contracts.escrow);
    await insurance.waitForDeployment();
    contracts.insurance = await insurance.getAddress();

    // 8. Deploy SkillFiNFT
    const SkillFiNFT = await ethers.getContractFactory("SkillFiNFT");
    nft = await SkillFiNFT.deploy(contracts.escrow, contracts.rewards);
    await nft.waitForDeployment();
    contracts.nft = await nft.getAddress();

    console.log("All contracts deployed successfully");
  }

  async function setupInitialState() {
    // Setup contract connections
    await dao.setMarketplaceContract(contracts.escrow);
    await skillToken.addMinter(contracts.escrow);
    await skillToken.addMinter(contracts.staking);
    await skillToken.addMinter(contracts.rewards);
    await skillToken.setMarketplaceContract(contracts.escrow);
    await skillToken.setStakingContract(contracts.staking);

    // Distribute tokens
    await skillToken.connect(treasury).transfer(client.address, ethers.parseEther("50000"));
    await skillToken.connect(treasury).transfer(freelancer.address, ethers.parseEther("50000"));
    await skillToken.connect(treasury).transfer(voter1.address, ethers.parseEther("10000"));
    await skillToken.connect(treasury).transfer(voter2.address, ethers.parseEther("10000"));

    // Setup voting power
    await skillToken.connect(client).delegate(client.address);
    await skillToken.connect(freelancer).delegate(freelancer.address);
    await skillToken.connect(voter1).delegate(voter1.address);
    await skillToken.connect(voter2).delegate(voter2.address);

    // Setup approvals
    await skillToken.connect(client).approve(contracts.escrow, ethers.parseEther("100000"));
    await skillToken.connect(freelancer).approve(contracts.escrow, ethers.parseEther("100000"));
    await skillToken.connect(client).approve(contracts.staking, ethers.parseEther("100000"));
    await skillToken.connect(freelancer).approve(contracts.staking, ethers.parseEther("100000"));
    await skillToken.connect(client).approve(contracts.insurance, ethers.parseEther("100000"));
    await skillToken.connect(freelancer).approve(contracts.insurance, ethers.parseEther("100000"));

    console.log("Initial state setup completed");
  }

  describe("Token System", function () {
    it("Should have correct initial setup", async function () {
      expect(await skillToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await skillToken.name()).to.equal("SkillFi Token");
      expect(await skillToken.symbol()).to.equal("SKILL");
    });

    it("Should allow minting within limits", async function () {
      await skillToken.addMinter(owner.address);
      const mintAmount = ethers.parseEther("1000000");
      
      await skillToken.mint(client.address, mintAmount);
      expect(await skillToken.balanceOf(client.address)).to.be.gt(ethers.parseEther("50000"));
    });

    it("Should prevent unauthorized minting", async function () {
      await expect(
        skillToken.connect(client).mint(client.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Not authorized to mint");
    });
  });

  describe("Staking System", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);
    });

    it("Should allow staking with different lock periods", async function () {
      const stakeAmount = ethers.parseEther("5000");
      
      // Stake with 90-day lock
      await expect(
        staking.connect(client).stake(stakeAmount, 90 * 24 * 3600)
      ).to.emit(staking, "Staked")
       .withArgs(client.address, stakeAmount, 90 * 24 * 3600);

      const stakeInfo = await staking.stakes(client.address);
      expect(stakeInfo.amount).to.equal(stakeAmount);
      expect(stakeInfo.lockPeriod).to.equal(90 * 24 * 3600);
    });

    it("Should calculate voting power with lock multipliers", async function () {
      const stakeAmount = ethers.parseEther("10000");
      
      // Stake with 365-day lock (2x multiplier)
      await staking.connect(client).stake(stakeAmount, 365 * 24 * 3600);
      
      const votingPower = await staking.getVotingPower(client.address);
      expect(votingPower).to.equal(stakeAmount * 2n); // 2x multiplier
    });

    it("Should prevent unstaking during lock period", async function () {
      const stakeAmount = ethers.parseEther("5000");
      
      await staking.connect(client).stake(stakeAmount, 30 * 24 * 3600);
      
      await expect(
        staking.connect(client).unstake(stakeAmount)
      ).to.be.revertedWith("Tokens still locked");
    });

    it("Should allow claiming staking rewards", async function () {
      const stakeAmount = ethers.parseEther("10000");
      
      await staking.connect(client).stake(stakeAmount, 0);
      
      // Fast forward time to accumulate rewards
      await time.increase(86400); // 1 day
      
      const earnedBefore = await staking.earned(client.address);
      expect(earnedBefore).to.be.gt(0);
      
      await expect(
        staking.connect(client).claimReward()
      ).to.emit(staking, "RewardClaimed");
    });
  });

  describe("Escrow and Project System", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);
    });

    it("Should create project successfully", async function () {
      const title = "Build DeFi Dashboard";
      const description = "Create a comprehensive DeFi analytics dashboard";
      const deadline = Math.floor(Date.now() / 1000) + 86400 * 30;
      const skills = ["React", "Web3", "TypeScript"];

      await expect(
        escrow.connect(client).createProject(
          title,
          description,
          PROJECT_AMOUNT,
          deadline,
          skills,
          []
        )
      ).to.emit(escrow, "ProjectCreated")
       .withArgs(1, client.address, title, PROJECT_AMOUNT, false);
    });

    it("Should complete full project lifecycle", async function () {
      // Create project
      await escrow.connect(client).createProject(
        "Test Project",
        "Test Description",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      // Accept freelancer
      await escrow.connect(client).acceptFreelancer(1, freelancer.address);

      // Complete project
      const initialBalance = await skillToken.balanceOf(freelancer.address);
      await escrow.connect(client).completeProject(1);
      const finalBalance = await skillToken.balanceOf(freelancer.address);

      expect(finalBalance).to.be.gt(initialBalance);

      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed
    });

    it("Should handle milestone projects", async function () {
      const milestones = [
        {
          description: "Phase 1",
          amount: ethers.parseEther("2500"),
          deadline: Math.floor(Date.now() / 1000) + 86400 * 10,
          completed: false,
          approved: false
        },
        {
          description: "Phase 2",
          amount: ethers.parseEther("2500"),
          deadline: Math.floor(Date.now() / 1000) + 86400 * 20,
          completed: false,
          approved: false
        }
      ];

      await escrow.connect(client).createProject(
        "Milestone Project",
        "Project with milestones",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["React"],
        milestones
      );

      await escrow.connect(client).acceptFreelancer(1, freelancer.address);

      // Complete first milestone
      const initialBalance = await skillToken.balanceOf(freelancer.address);
      await escrow.connect(client).completeMilestone(1, 0);
      const balanceAfterFirst = await skillToken.balanceOf(freelancer.address);

      expect(balanceAfterFirst).to.be.gt(initialBalance);

      // Complete second milestone
      await escrow.connect(client).completeMilestone(1, 1);
      const finalBalance = await skillToken.balanceOf(freelancer.address);

      expect(finalBalance).to.be.gt(balanceAfterFirst);

      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed
    });
  });

  describe("Rewards System", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);
    });

    it("Should register referrals", async function () {
      await rewards.connect(freelancer).registerReferral(client.address);
      
      const userReward = await rewards.userRewards(freelancer.address);
      expect(userReward.referrer).to.equal(client.address);
    });

    it("Should track loyalty points and tiers", async function () {
      // Create and complete a project to earn points
      await escrow.connect(client).createProject(
        "Test Project",
        "Test Description",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      await escrow.connect(client).acceptFreelancer(1, freelancer.address);
      await escrow.connect(client).completeProject(1);

      const userReward = await rewards.userRewards(freelancer.address);
      expect(userReward.loyaltyPoints).to.be.gt(0);
    });

    it("Should allow claiming daily rewards", async function () {
      // First complete a project to have activity
      await escrow.connect(client).createProject(
        "Test Project",
        "Test Description",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      await escrow.connect(client).acceptFreelancer(1, freelancer.address);
      await escrow.connect(client).completeProject(1);

      // Now claim daily reward
      await expect(
        rewards.connect(freelancer).claimDailyReward()
      ).to.emit(rewards, "RewardClaimed");
    });
  });

  describe("Insurance System", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);

      // Create a project first
      await escrow.connect(client).createProject(
        "Insured Project",
        "Project with insurance",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );
    });

    it("Should purchase insurance policy", async function () {
      const coverageAmount = ethers.parseEther("3000");
      const coveragePeriod = 30 * 24 * 3600; // 30 days

      await expect(
        insurance.connect(client).purchaseInsurance(
          1, // projectId
          0, // ProjectCompletion insurance
          coverageAmount,
          coveragePeriod
        )
      ).to.emit(insurance, "PolicyCreated");

      const policy = await insurance.getPolicy(1);
      expect(policy.coverageAmount).to.equal(coverageAmount);
      expect(policy.policyholder).to.equal(client.address);
    });

    it("Should submit and process insurance claims", async function () {
      const coverageAmount = ethers.parseEther("3000");
      const coveragePeriod = 30 * 24 * 3600;

      // Purchase insurance
      await insurance.connect(client).purchaseInsurance(
        1,
        0,
        coverageAmount,
        coveragePeriod
      );

      // Submit claim
      const claimAmount = ethers.parseEther("2000");
      await expect(
        insurance.connect(client).submitClaim(
          1, // policyId
          claimAmount,
          "Project not completed as agreed"
        )
      ).to.emit(insurance, "ClaimSubmitted");

      // Process claim (as owner)
      await expect(
        insurance.processClaim(
          1, // claimId
          2, // Approved
          claimAmount,
          "Claim approved after review"
        )
      ).to.emit(insurance, "ClaimProcessed");
    });
  });

  describe("NFT System", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);
    });

    it("Should mint project completion NFT", async function () {
      // Create and complete project
      await escrow.connect(client).createProject(
        "NFT Test Project",
        "Project for NFT testing",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      await escrow.connect(client).acceptFreelancer(1, freelancer.address);
      await escrow.connect(client).completeProject(1);

      // Mint NFT (this would normally be called by escrow)
      await expect(
        nft.mintProjectCompletion(1, freelancer.address)
      ).to.emit(nft, "NFTMinted");

      const userNFTs = await nft.getUserNFTs(freelancer.address);
      expect(userNFTs.length).to.equal(1);

      const metadata = await nft.getNFTMetadata(1);
      expect(metadata.nftType).to.equal(0); // ProjectCompletion
      expect(metadata.recipient).to.equal(freelancer.address);
    });

    it("Should mint skill certification NFT", async function () {
      await expect(
        nft.mintSkillCertification(
          freelancer.address,
          "JavaScript",
          8, // level
          25, // projects completed
          ethers.parseEther("50000"), // total value
          45 // average rating (4.5)
        )
      ).to.emit(nft, "SkillCertified");

      const certification = await nft.getSkillCertification(freelancer.address, "JavaScript");
      expect(certification.level).to.equal(8);
      expect(certification.skillName).to.equal("JavaScript");
    });

    it("Should generate proper token URI", async function () {
      await nft.mintMilestone(
        freelancer.address,
        "Test Milestone",
        "Test milestone NFT",
        2, // Rare
        ["Test Attribute"]
      );

      const tokenURI = await nft.tokenURI(1);
      expect(tokenURI).to.include("data:application/json;base64");
    });
  });

  describe("DAO and Dispute Resolution", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);

      // Create and start project
      await escrow.connect(client).createProject(
        "Disputed Project",
        "This will be disputed",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );
      await escrow.connect(client).acceptFreelancer(1, freelancer.address);
    });

    it("Should create and resolve disputes", async function () {
      // Raise dispute
      await expect(
        escrow.connect(client).raiseDispute(1, "Work not delivered as promised")
      ).to.emit(escrow, "DisputeRaised");

      const project = await escrow.getProject(1);
      expect(project.status).to.equal(4); // Disputed

      // Vote on dispute
      await dao.connect(voter1).voteOnDispute(1, true); // Support client
      await dao.connect(voter2).voteOnDispute(1, false); // Support freelancer

      // Wait for voting period
      await time.increase(3 * 24 * 3600 + 1); // 3 days + 1 second

      // Resolve dispute
      await dao.resolveDispute(1);

      const dispute = await dao.getDispute(1);
      expect(dispute.resolved).to.be.true;
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete ecosystem workflow", async function () {
      // Setup stakes
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);

      // Register referral
      await rewards.connect(freelancer).registerReferral(client.address);

      // Create project
      await escrow.connect(client).createProject(
        "Full Integration Test",
        "Complete workflow test",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["React", "Node.js"],
        []
      );

      // Purchase insurance
      await insurance.connect(client).purchaseInsurance(
        1,
        0, // ProjectCompletion
        ethers.parseEther("3000"),
        30 * 24 * 3600
      );

      // Accept freelancer
      await escrow.connect(client).acceptFreelancer(1, freelancer.address);

      // Complete project
      await escrow.connect(client).completeProject(1);

      // Rate each other
      await escrow.connect(client).rateUser(1, freelancer.address, 5);
      await escrow.connect(freelancer).rateUser(1, client.address, 4);

      // Mint completion NFT
      await nft.mintProjectCompletion(1, freelancer.address);

      // Verify final state
      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed

      const freelancerRating = await escrow.getUserRating(freelancer.address);
      expect(freelancerRating).to.equal(5);

      const userNFTs = await nft.getUserNFTs(freelancer.address);
      expect(userNFTs.length).to.equal(1);

      const userReward = await rewards.userRewards(freelancer.address);
      expect(userReward.loyaltyPoints).to.be.gt(0);

      console.log("✅ Complete ecosystem workflow test passed!");
    });

    it("Should maintain consistency across all contracts", async function () {
      // Verify all contract addresses are set correctly
      expect(await dao.token()).to.equal(contracts.skillToken);
      expect(await escrow.skillToken()).to.equal(contracts.skillToken);
      expect(await escrow.dao()).to.equal(contracts.dao);
      expect(await staking.skillToken()).to.equal(contracts.skillToken);
      expect(await rewards.skillToken()).to.equal(contracts.skillToken);
      expect(await rewards.escrow()).to.equal(contracts.escrow);
      expect(await insurance.skillToken()).to.equal(contracts.skillToken);
      expect(await insurance.escrow()).to.equal(contracts.escrow);
      expect(await nft.escrow()).to.equal(contracts.escrow);
      expect(await nft.rewards()).to.equal(contracts.rewards);

      console.log("✅ All contract connections verified!");
    });
  });

  describe("Security and Edge Cases", function () {
    it("Should prevent unauthorized access", async function () {
      // Test various unauthorized access attempts
      await expect(
        skillToken.connect(client).mint(client.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Not authorized to mint");

      await expect(
        dao.connect(client).setMarketplaceContract(client.address)
      ).to.be.reverted;

      await expect(
        nft.connect(client).mintProjectCompletion(1, client.address)
      ).to.be.revertedWith("Only escrow can mint");
    });

    it("Should handle edge cases gracefully", async function () {
      // Test with zero amounts
      await expect(
        escrow.connect(client).createProject(
          "Test",
          "Test",
          0,
          Math.floor(Date.now() / 1000) + 86400,
          ["Test"],
          []
        )
      ).to.be.revertedWith("Amount must be greater than 0");

      // Test with invalid deadlines
      await expect(
        escrow.connect(client).createProject(
          "Test",
          "Test",
          ethers.parseEther("1000"),
          Math.floor(Date.now() / 1000) - 86400, // Past deadline
          ["Test"],
          []
        )
      ).to.be.revertedWith("Invalid deadline");
    });
  });
});