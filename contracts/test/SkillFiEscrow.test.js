const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SkillFi Advanced Contracts", function () {
  let skillToken, dao, escrow, timelock;
  let owner, client, freelancer, voter1, voter2, treasury;
  let proposers, executors;

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100M tokens
  const STAKE_AMOUNT = ethers.parseEther("1000"); // 1000 SKILL tokens
  const PROJECT_AMOUNT = ethers.parseEther("5000"); // 5000 SKILL tokens

  beforeEach(async function () {
    [owner, client, freelancer, voter1, voter2, treasury] = await ethers.getSigners();
    
    // Deploy SkillToken
    const SkillToken = await ethers.getContractFactory("SkillToken");
    skillToken = await SkillToken.deploy(treasury.address);
    await skillToken.waitForDeployment();

    // Setup timelock for DAO
    proposers = [owner.address];
    executors = [owner.address];
    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(
      86400, // 1 day delay
      proposers,
      executors,
      owner.address
    );
    await timelock.waitForDeployment();

    // Deploy DAO
    const SkillFiDAO = await ethers.getContractFactory("SkillFiDAO");
    dao = await SkillFiDAO.deploy(
      await skillToken.getAddress(),
      await timelock.getAddress()
    );
    await dao.waitForDeployment();

    // Deploy Escrow
    const SkillFiEscrow = await ethers.getContractFactory("SkillFiEscrow");
    escrow = await SkillFiEscrow.deploy(
      await skillToken.getAddress(),
      await dao.getAddress(),
      treasury.address
    );
    await escrow.waitForDeployment();

    // Set marketplace contract in DAO
    await dao.setMarketplaceContract(await escrow.getAddress());

    // Distribute tokens for testing
    await skillToken.connect(treasury).transfer(client.address, ethers.parseEther("50000"));
    await skillToken.connect(treasury).transfer(freelancer.address, ethers.parseEther("50000"));
    await skillToken.connect(treasury).transfer(voter1.address, ethers.parseEther("10000"));
    await skillToken.connect(treasury).transfer(voter2.address, ethers.parseEther("10000"));

    // Delegate voting power
    await skillToken.connect(client).delegate(client.address);
    await skillToken.connect(freelancer).delegate(freelancer.address);
    await skillToken.connect(voter1).delegate(voter1.address);
    await skillToken.connect(voter2).delegate(voter2.address);

    // Approve escrow to spend tokens
    await skillToken.connect(client).approve(await escrow.getAddress(), ethers.parseEther("100000"));
    await skillToken.connect(freelancer).approve(await escrow.getAddress(), ethers.parseEther("100000"));
  });

  describe("SkillToken", function () {
    it("Should have correct initial supply", async function () {
      expect(await skillToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await skillToken.balanceOf(treasury.address)).to.be.gt(0);
    });

    it("Should allow minting within yearly cap", async function () {
      await skillToken.addMinter(owner.address);
      const mintAmount = ethers.parseEther("1000000"); // 1M tokens
      
      await skillToken.mint(client.address, mintAmount);
      expect(await skillToken.balanceOf(client.address)).to.be.gt(ethers.parseEther("50000"));
    });

    it("Should prevent minting beyond yearly cap", async function () {
      await skillToken.addMinter(owner.address);
      const excessiveAmount = ethers.parseEther("60000000"); // 60M tokens (exceeds 50M cap)
      
      await expect(
        skillToken.mint(client.address, excessiveAmount)
      ).to.be.revertedWith("Exceeds yearly mint cap");
    });
  });

  describe("SkillFiEscrow - Basic Functionality", function () {
    beforeEach(async function () {
      // Deposit stakes
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);
    });

    it("Should create a project successfully", async function () {
      const title = "Build a DeFi Dashboard";
      const description = "Create a comprehensive DeFi analytics dashboard";
      const deadline = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
      const skills = ["React", "Web3", "TypeScript"];

      await expect(
        escrow.connect(client).createProject(
          title,
          description,
          PROJECT_AMOUNT,
          deadline,
          skills,
          [] // No milestones
        )
      ).to.emit(escrow, "ProjectCreated")
       .withArgs(1, client.address, title, PROJECT_AMOUNT, false);

      const project = await escrow.getProject(1);
      expect(project.title).to.equal(title);
      expect(project.client).to.equal(client.address);
      expect(project.totalAmount).to.equal(PROJECT_AMOUNT);
    });

    it("Should accept freelancer and start project", async function () {
      // Create project first
      await escrow.connect(client).createProject(
        "Test Project",
        "Test Description",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      await expect(
        escrow.connect(client).acceptFreelancer(1, freelancer.address)
      ).to.emit(escrow, "ProposalAccepted")
       .withArgs(1, freelancer.address, PROJECT_AMOUNT);

      const project = await escrow.getProject(1);
      expect(project.freelancer).to.equal(freelancer.address);
      expect(project.status).to.equal(1); // InProgress
    });

    it("Should complete project and transfer payment", async function () {
      // Setup project
      await escrow.connect(client).createProject(
        "Test Project",
        "Test Description",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );
      await escrow.connect(client).acceptFreelancer(1, freelancer.address);

      const initialBalance = await skillToken.balanceOf(freelancer.address);

      await expect(
        escrow.connect(client).completeProject(1)
      ).to.emit(escrow, "ProjectCompleted")
       .withArgs(1, freelancer.address, PROJECT_AMOUNT);

      const finalBalance = await skillToken.balanceOf(freelancer.address);
      expect(finalBalance).to.be.gt(initialBalance);

      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed
    });
  });

  describe("SkillFiEscrow - Milestone Projects", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);
    });

    it("Should create project with milestones", async function () {
      const milestones = [
        {
          description: "Design Phase",
          amount: ethers.parseEther("2000"),
          deadline: Math.floor(Date.now() / 1000) + 86400 * 10,
          completed: false,
          approved: false
        },
        {
          description: "Development Phase",
          amount: ethers.parseEther("3000"),
          deadline: Math.floor(Date.now() / 1000) + 86400 * 20,
          completed: false,
          approved: false
        }
      ];

      await expect(
        escrow.connect(client).createProject(
          "Milestone Project",
          "Project with milestones",
          PROJECT_AMOUNT,
          Math.floor(Date.now() / 1000) + 86400 * 30,
          ["React"],
          milestones
        )
      ).to.emit(escrow, "ProjectCreated")
       .withArgs(1, client.address, "Milestone Project", PROJECT_AMOUNT, true);
    });

    it("Should complete milestones and pay incrementally", async function () {
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

      // Create milestone project
      await escrow.connect(client).createProject(
        "Milestone Project",
        "Test milestone project",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["React"],
        milestones
      );

      await escrow.connect(client).acceptFreelancer(1, freelancer.address);

      const initialBalance = await skillToken.balanceOf(freelancer.address);

      // Complete first milestone
      await expect(
        escrow.connect(client).completeMilestone(1, 0)
      ).to.emit(escrow, "MilestoneCompleted")
       .withArgs(1, 0, ethers.parseEther("2500"));

      const balanceAfterFirst = await skillToken.balanceOf(freelancer.address);
      expect(balanceAfterFirst).to.be.gt(initialBalance);

      // Complete second milestone
      await escrow.connect(client).completeMilestone(1, 1);

      const finalBalance = await skillToken.balanceOf(freelancer.address);
      expect(finalBalance).to.be.gt(balanceAfterFirst);

      // Project should be completed
      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed
    });
  });

  describe("SkillFiEscrow - Anti-Scam Mechanisms", function () {
    it("Should require stake to create project", async function () {
      await expect(
        escrow.connect(client).createProject(
          "Test Project",
          "Test Description",
          PROJECT_AMOUNT,
          Math.floor(Date.now() / 1000) + 86400 * 30,
          ["JavaScript"],
          []
        )
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should enforce cooldown period", async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      
      // Create first project
      await escrow.connect(client).createProject(
        "Project 1",
        "First project",
        ethers.parseEther("1000"),
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      // Try to create second project immediately (should fail due to cooldown)
      await expect(
        escrow.connect(client).createProject(
          "Project 2",
          "Second project",
          ethers.parseEther("1000"),
          Math.floor(Date.now() / 1000) + 86400 * 30,
          ["JavaScript"],
          []
        )
      ).to.be.revertedWith("Cooldown period not met");
    });

    it("Should allow stake withdrawal only with no active projects", async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      
      // Create project
      await escrow.connect(client).createProject(
        "Test Project",
        "Test Description",
        ethers.parseEther("1000"),
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );

      // Try to withdraw stake (should fail)
      await expect(
        escrow.connect(client).withdrawStake(ethers.parseEther("500"))
      ).to.be.revertedWith("Cannot withdraw with active projects");
    });
  });

  describe("SkillFiEscrow - Rating System", function () {
    beforeEach(async function () {
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);

      // Create and complete a project
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
    });

    it("Should allow rating after project completion", async function () {
      await expect(
        escrow.connect(client).rateUser(1, freelancer.address, 5)
      ).to.emit(escrow, "UserRated")
       .withArgs(1, client.address, freelancer.address, 5);

      const rating = await escrow.getUserRating(freelancer.address);
      expect(rating).to.equal(5);
    });

    it("Should prevent duplicate ratings", async function () {
      await escrow.connect(client).rateUser(1, freelancer.address, 5);

      await expect(
        escrow.connect(client).rateUser(1, freelancer.address, 4)
      ).to.be.revertedWith("Already rated");
    });

    it("Should calculate average rating correctly", async function () {
      // Rate from client
      await escrow.connect(client).rateUser(1, freelancer.address, 5);
      
      // Create another project for second rating
      await time.increase(3600); // Increase time to pass cooldown
      await escrow.connect(client).createProject(
        "Project 2",
        "Second project",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["JavaScript"],
        []
      );
      await escrow.connect(client).acceptFreelancer(2, freelancer.address);
      await escrow.connect(client).completeProject(2);
      
      // Rate from freelancer (reverse rating)
      await escrow.connect(freelancer).rateUser(2, client.address, 4);

      const freelancerRating = await escrow.getUserRating(freelancer.address);
      const clientRating = await escrow.getUserRating(client.address);
      
      expect(freelancerRating).to.equal(5);
      expect(clientRating).to.equal(4);
    });
  });

  describe("SkillFiDAO - Dispute Resolution", function () {
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

    it("Should create dispute", async function () {
      await expect(
        escrow.connect(client).raiseDispute(1, "Work not delivered as promised")
      ).to.emit(escrow, "DisputeRaised")
       .withArgs(1, client.address, 1);

      const project = await escrow.getProject(1);
      expect(project.status).to.equal(4); // Disputed
      expect(project.disputeId).to.equal(1);
    });

    it("Should allow DAO voting on disputes", async function () {
      // Raise dispute
      await escrow.connect(client).raiseDispute(1, "Quality issues");

      // Vote on dispute (need sufficient voting power)
      await expect(
        dao.connect(voter1).voteOnDispute(1, true) // Support client
      ).to.emit(dao, "DisputeVote")
       .withArgs(1, voter1.address, true, await skillToken.getVotes(voter1.address));

      await expect(
        dao.connect(voter2).voteOnDispute(1, false) // Support freelancer
      ).to.emit(dao, "DisputeVote")
       .withArgs(1, voter2.address, false, await skillToken.getVotes(voter2.address));
    });

    it("Should resolve dispute based on votes", async function () {
      // Raise dispute
      await escrow.connect(client).raiseDispute(1, "Dispute reason");

      // Vote (client wins)
      await dao.connect(voter1).voteOnDispute(1, true);
      await dao.connect(voter2).voteOnDispute(1, true);

      // Wait for voting period to end
      await time.increase(3 * 24 * 3600 + 1); // 3 days + 1 second

      // Resolve dispute
      await expect(
        dao.resolveDispute(1)
      ).to.emit(dao, "DisputeResolved");

      const dispute = await dao.getDispute(1);
      expect(dispute.resolved).to.be.true;
      expect(dispute.winner).to.equal(client.address);
    });

    it("Should distribute funds based on dispute resolution", async function () {
      const initialClientBalance = await skillToken.balanceOf(client.address);
      
      // Raise and resolve dispute in favor of client
      await escrow.connect(client).raiseDispute(1, "Dispute reason");
      await dao.connect(voter1).voteOnDispute(1, true);
      await dao.connect(voter2).voteOnDispute(1, true);
      
      await time.increase(3 * 24 * 3600 + 1);
      await dao.resolveDispute(1);
      
      // Resolve dispute in escrow
      await escrow.resolveDispute(1);

      const finalClientBalance = await skillToken.balanceOf(client.address);
      expect(finalClientBalance).to.be.gt(initialClientBalance);

      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete project lifecycle with ratings", async function () {
      // Setup
      await escrow.connect(client).depositStake(STAKE_AMOUNT);
      await escrow.connect(freelancer).depositStake(STAKE_AMOUNT);

      // Create project
      await escrow.connect(client).createProject(
        "Full Lifecycle Project",
        "Complete project test",
        PROJECT_AMOUNT,
        Math.floor(Date.now() / 1000) + 86400 * 30,
        ["React", "Node.js"],
        []
      );

      // Accept freelancer
      await escrow.connect(client).acceptFreelancer(1, freelancer.address);

      // Submit work
      await escrow.connect(freelancer).submitWork(1);

      // Complete project
      await escrow.connect(client).completeProject(1);

      // Rate each other
      await escrow.connect(client).rateUser(1, freelancer.address, 5);
      await escrow.connect(freelancer).rateUser(1, client.address, 4);

      // Verify final state
      const project = await escrow.getProject(1);
      expect(project.status).to.equal(3); // Completed

      const freelancerRating = await escrow.getUserRating(freelancer.address);
      const clientRating = await escrow.getUserRating(client.address);
      
      expect(freelancerRating).to.equal(5);
      expect(clientRating).to.equal(4);

      // Check reputation updates
      const freelancerRep = await escrow.userReputations(freelancer.address);
      expect(freelancerRep.completedProjects).to.equal(1);
      expect(freelancerRep.totalEarned).to.be.gt(0);
    });
  });
});