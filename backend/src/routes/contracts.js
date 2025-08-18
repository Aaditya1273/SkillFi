const express = require('express');
const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Contract ABI (simplified for demo)
const MARKETPLACE_ABI = [
  "function createProject(string memory _title, string memory _description, uint256 _deadline, string[] memory _skills) external payable",
  "function submitProposal(uint256 _projectId, uint256 _bidAmount, string memory _description, uint256 _deliveryTime) external",
  "function acceptProposal(uint256 _proposalId) external",
  "function completeProject(uint256 _projectId) external",
  "function getProject(uint256 _projectId) external view returns (tuple(uint256 id, address client, string title, string description, uint256 budget, uint256 deadline, uint8 status, address assignedFreelancer, uint256 createdAt, string[] skills))",
  "event ProjectCreated(uint256 indexed projectId, address indexed client, string title, uint256 budget)",
  "event ProposalAccepted(uint256 indexed proposalId, uint256 indexed projectId, address indexed freelancer)"
];

const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_CONTRACT_ADDRESS;

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');

// Create project on blockchain
router.post('/create-project', auth, async (req, res) => {
  try {
    const { projectId, privateKey } = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required for blockchain transaction' });
    }

    // Get project from database
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create wallet and contract instance
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, wallet);

    // Convert budget to wei
    const budgetWei = ethers.parseEther(project.budget.toString());

    // Create project on blockchain
    const tx = await contract.createProject(
      project.title,
      project.description,
      Math.floor(project.deadline?.getTime() / 1000) || Math.floor(Date.now() / 1000) + 86400,
      project.skills,
      { value: budgetWei }
    );

    const receipt = await tx.wait();

    // Extract project ID from event logs
    const projectCreatedEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'ProjectCreated';
      } catch {
        return false;
      }
    });

    let blockchainProjectId = null;
    if (projectCreatedEvent) {
      const parsed = contract.interface.parseLog(projectCreatedEvent);
      blockchainProjectId = parsed.args.projectId.toString();
    }

    // Update project with contract address and blockchain ID
    await prisma.project.update({
      where: { id: projectId },
      data: {
        contractAddress: MARKETPLACE_ADDRESS,
        // You might want to add a blockchainId field to store the on-chain project ID
      }
    });

    res.json({
      success: true,
      transactionHash: tx.hash,
      blockchainProjectId,
      gasUsed: receipt.gasUsed.toString()
    });
  } catch (error) {
    console.error('Blockchain project creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create project on blockchain',
      details: error.message
    });
  }
});

// Submit proposal on blockchain
router.post('/submit-proposal', auth, async (req, res) => {
  try {
    const { proposalId, privateKey } = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required for blockchain transaction' });
    }

    // Get proposal from database
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { project: true }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.freelancerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create wallet and contract instance
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, wallet);

    // Submit proposal on blockchain
    const bidAmountWei = ethers.parseEther(proposal.bidAmount.toString());
    
    const tx = await contract.submitProposal(
      1, // This should be the blockchain project ID
      bidAmountWei,
      proposal.description,
      proposal.deliveryTime
    );

    const receipt = await tx.wait();

    res.json({
      success: true,
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed.toString()
    });
  } catch (error) {
    console.error('Blockchain proposal submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit proposal on blockchain',
      details: error.message
    });
  }
});

// Accept proposal on blockchain
router.post('/accept-proposal', auth, async (req, res) => {
  try {
    const { proposalId, privateKey } = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required for blockchain transaction' });
    }

    // Get proposal from database
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { project: true }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create wallet and contract instance
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, wallet);

    // Accept proposal on blockchain
    const tx = await contract.acceptProposal(1); // This should be the blockchain proposal ID

    const receipt = await tx.wait();

    res.json({
      success: true,
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed.toString()
    });
  } catch (error) {
    console.error('Blockchain proposal acceptance error:', error);
    res.status(500).json({ 
      error: 'Failed to accept proposal on blockchain',
      details: error.message
    });
  }
});

// Complete project and release payment
router.post('/complete-project', auth, async (req, res) => {
  try {
    const { projectId, privateKey } = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required for blockchain transaction' });
    }

    // Get project from database
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create wallet and contract instance
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, wallet);

    // Complete project on blockchain
    const tx = await contract.completeProject(1); // This should be the blockchain project ID

    const receipt = await tx.wait();

    // Update project status in database
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' }
    });

    res.json({
      success: true,
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed.toString()
    });
  } catch (error) {
    console.error('Blockchain project completion error:', error);
    res.status(500).json({ 
      error: 'Failed to complete project on blockchain',
      details: error.message
    });
  }
});

// Get blockchain project data
router.get('/project/:blockchainId', async (req, res) => {
  try {
    const { blockchainId } = req.params;

    const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
    
    const projectData = await contract.getProject(blockchainId);

    res.json({
      id: projectData.id.toString(),
      client: projectData.client,
      title: projectData.title,
      description: projectData.description,
      budget: ethers.formatEther(projectData.budget),
      deadline: new Date(Number(projectData.deadline) * 1000),
      status: projectData.status,
      assignedFreelancer: projectData.assignedFreelancer,
      createdAt: new Date(Number(projectData.createdAt) * 1000),
      skills: projectData.skills
    });
  } catch (error) {
    console.error('Error fetching blockchain project:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project from blockchain',
      details: error.message
    });
  }
});

module.exports = router;