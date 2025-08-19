const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');
const repEventRepo = require('../repositories/reputationEventRepository');
const reputationService = require('./reputationService');

const prisma = new PrismaClient();

const MARKETPLACE_ABI = [
  "event ProjectCreated(uint256 indexed projectId, address indexed client, string title, uint256 budget)",
  "event ProposalAccepted(uint256 indexed proposalId, uint256 indexed projectId, address indexed freelancer)"
];

async function userIdByWallet(address) {
  if (!address) return null;
  const user = await prisma.user.findFirst({ where: { walletAddress: address.toLowerCase() } });
  if (user) return user.id;
  // try checksum or raw
  const alt = await prisma.user.findFirst({ where: { walletAddress: address } });
  return alt?.id || null;
}

async function handleProjectCreated(contract, log) {
  try {
    const parsed = contract.interface.parseLog(log);
    const client = parsed.args.client;
    const clientId = await userIdByWallet(client);
    if (!clientId) return;

    await repEventRepo.addEvent({
      userId: clientId,
      type: 'ESCROW_COMPLETED', // treat creation as neutral/low positive for now
      weight: 0.5,
      delta: 2,
      metadata: { event: 'ProjectCreated', projectId: parsed.args.projectId.toString(), budget: parsed.args.budget?.toString?.() }
    });
    await reputationService.recomputeUser(clientId);
  } catch (e) {
    console.error('handleProjectCreated error', e);
  }
}

async function handleProposalAccepted(contract, log) {
  try {
    const parsed = contract.interface.parseLog(log);
    const freelancer = parsed.args.freelancer;
    const freelancerId = await userIdByWallet(freelancer);
    if (!freelancerId) return;

    await repEventRepo.addEvent({
      userId: freelancerId,
      type: 'ESCROW_COMPLETED', // selection signal: small boost
      weight: 1,
      delta: 5,
      metadata: { event: 'ProposalAccepted', projectId: parsed.args.projectId.toString(), proposalId: parsed.args.proposalId.toString() }
    });
    await reputationService.recomputeUser(freelancerId);
  } catch (e) {
    console.error('handleProposalAccepted error', e);
  }
}

function start({ rpcUrl, contractAddress }) {
  if (!rpcUrl || !contractAddress) {
    console.warn('[onchainListeners] Missing rpcUrl or contractAddress; listeners not started');
    return null;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, MARKETPLACE_ABI, provider);

  const handlers = [];

  const onProjectCreated = (log) => handleProjectCreated(contract, log);
  const onProposalAccepted = (log) => handleProposalAccepted(contract, log);

  provider.on({ address: contractAddress, topics: [contract.interface.getEvent("ProjectCreated").topicHash] }, onProjectCreated);
  provider.on({ address: contractAddress, topics: [contract.interface.getEvent("ProposalAccepted").topicHash] }, onProposalAccepted);

  handlers.push(() => provider.off({ address: contractAddress, topics: [contract.interface.getEvent("ProjectCreated").topicHash] }, onProjectCreated));
  handlers.push(() => provider.off({ address: contractAddress, topics: [contract.interface.getEvent("ProposalAccepted").topicHash] }, onProposalAccepted));

  console.log('[onchainListeners] Started for', contractAddress);

  return {
    stop() {
      for (const off of handlers) off();
      console.log('[onchainListeners] Stopped for', contractAddress);
    }
  };
}

module.exports = { start };
