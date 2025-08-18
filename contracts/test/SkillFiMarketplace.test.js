const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SkillFiMarketplace", function () {
  let marketplace;
  let owner, client, freelancer;

  beforeEach(async function () {
    [owner, client, freelancer] = await ethers.getSigners();
    
    const SkillFiMarketplace = await ethers.getContractFactory("SkillFiMarketplace");
    marketplace = await SkillFiMarketplace.deploy();
    await marketplace.waitForDeployment();
  });

  describe("Project Creation", function () {
    it("Should create a project successfully", async function () {
      const title = "Test Project";
      const description = "Test Description";
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      const skills = ["JavaScript", "React"];
      const budget = ethers.parseEther("1.0");

      await expect(
        marketplace.connect(client).createProject(title, description, deadline, skills, {
          value: budget,
        })
      )
        .to.emit(marketplace, "ProjectCreated")
        .withArgs(1, client.address, title, budget);

      const project = await marketplace.getProject(1);
      expect(project.title).to.equal(title);
      expect(project.client).to.equal(client.address);
      expect(project.budget).to.equal(budget);
    });

    it("Should fail to create project with zero budget", async function () {
      const title = "Test Project";
      const description = "Test Description";
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const skills = ["JavaScript"];

      await expect(
        marketplace.connect(client).createProject(title, description, deadline, skills, {
          value: 0,
        })
      ).to.be.revertedWith("Budget must be greater than 0");
    });
  });

  describe("Proposal Submission", function () {
    beforeEach(async function () {
      const title = "Test Project";
      const description = "Test Description";
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const skills = ["JavaScript"];
      const budget = ethers.parseEther("1.0");

      await marketplace.connect(client).createProject(title, description, deadline, skills, {
        value: budget,
      });
    });

    it("Should submit a proposal successfully", async function () {
      const bidAmount = ethers.parseEther("0.8");
      const description = "I can do this project";
      const deliveryTime = 7; // 7 days

      await expect(
        marketplace.connect(freelancer).submitProposal(1, bidAmount, description, deliveryTime)
      )
        .to.emit(marketplace, "ProposalSubmitted")
        .withArgs(1, 1, freelancer.address, bidAmount);

      const proposal = await marketplace.getProposal(1);
      expect(proposal.freelancer).to.equal(freelancer.address);
      expect(proposal.bidAmount).to.equal(bidAmount);
    });

    it("Should fail when client tries to bid on own project", async function () {
      const bidAmount = ethers.parseEther("0.8");
      const description = "I can do this project";
      const deliveryTime = 7;

      await expect(
        marketplace.connect(client).submitProposal(1, bidAmount, description, deliveryTime)
      ).to.be.revertedWith("Cannot bid on own project");
    });
  });

  describe("Proposal Acceptance", function () {
    beforeEach(async function () {
      // Create project
      const title = "Test Project";
      const description = "Test Description";
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const skills = ["JavaScript"];
      const budget = ethers.parseEther("1.0");

      await marketplace.connect(client).createProject(title, description, deadline, skills, {
        value: budget,
      });

      // Submit proposal
      const bidAmount = ethers.parseEther("0.8");
      const proposalDescription = "I can do this project";
      const deliveryTime = 7;

      await marketplace.connect(freelancer).submitProposal(1, bidAmount, proposalDescription, deliveryTime);
    });

    it("Should accept a proposal successfully", async function () {
      await expect(marketplace.connect(client).acceptProposal(1))
        .to.emit(marketplace, "ProposalAccepted")
        .withArgs(1, 1, freelancer.address);

      const project = await marketplace.getProject(1);
      expect(project.status).to.equal(1); // InProgress
      expect(project.assignedFreelancer).to.equal(freelancer.address);
    });

    it("Should fail when non-client tries to accept proposal", async function () {
      await expect(
        marketplace.connect(freelancer).acceptProposal(1)
      ).to.be.revertedWith("Only client can accept proposals");
    });
  });

  describe("Project Completion", function () {
    beforeEach(async function () {
      // Create project, submit proposal, and accept it
      const title = "Test Project";
      const description = "Test Description";
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const skills = ["JavaScript"];
      const budget = ethers.parseEther("1.0");

      await marketplace.connect(client).createProject(title, description, deadline, skills, {
        value: budget,
      });

      const bidAmount = ethers.parseEther("0.8");
      const proposalDescription = "I can do this project";
      const deliveryTime = 7;

      await marketplace.connect(freelancer).submitProposal(1, bidAmount, proposalDescription, deliveryTime);
      await marketplace.connect(client).acceptProposal(1);
    });

    it("Should complete project and pay freelancer", async function () {
      const initialBalance = await ethers.provider.getBalance(freelancer.address);
      
      await expect(marketplace.connect(client).completeProject(1))
        .to.emit(marketplace, "ProjectCompleted");

      const project = await marketplace.getProject(1);
      expect(project.status).to.equal(2); // Completed

      const finalBalance = await ethers.provider.getBalance(freelancer.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });
});