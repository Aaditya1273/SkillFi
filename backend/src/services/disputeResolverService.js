const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function redact(text, maxLen = 2000) {
  if (!text) return '';
  const s = String(text);
  return s.length > maxLen ? s.slice(0, maxLen) + `... [truncated ${s.length - maxLen} chars]` : s;
}

function buildPrompt({ project, messages, proposals }) {
  const lines = [];
  lines.push('You are an impartial AI dispute resolver for a freelancer marketplace DAO.');
  lines.push('Analyze the evidence and recommend a fair outcome for DAO voting.');
  lines.push('Return a concise JSON with: { outcome, confidence, reasoning, evidence, suggestedDAOProposal }');
  lines.push('Outcomes allowed: "refund_to_client", "release_to_freelancer", "partial_split", "mediation_needed"');
  lines.push('---');
  lines.push('Project:');
  lines.push(JSON.stringify({
    id: project.id,
    title: project.title,
    description: redact(project.description, 4000),
    budget: project.budget,
    status: project.status,
    deadline: project.deadline,
    clientId: project.clientId,
    freelancerId: project.freelancerId
  }, null, 2));

  lines.push('--- Proposals (top 5 by createdAt desc)');
  lines.push(JSON.stringify(proposals.map(p => ({
    id: p.id,
    bidAmount: p.bidAmount,
    description: redact(p.description, 2000),
    deliveryTime: p.deliveryTime,
    status: p.status,
    freelancerId: p.freelancerId,
    createdAt: p.createdAt
  })), null, 2));

  lines.push('--- Messages (most recent 50)');
  lines.push(JSON.stringify(messages.map(m => ({
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    createdAt: m.createdAt,
    content: redact(m.content, 1000)
  })), null, 2));

  lines.push('--- Instruction: reason about scope, deadlines, delivery quality, tone and commitments; consider budget vs work delivered.');
  return lines.join('\n');
}

async function callLLM(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You output strict JSON only. No prose.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    try {
      return JSON.parse(content);
    } catch {
      return { outcome: 'mediation_needed', confidence: 0.5, reasoning: 'Non-JSON response', evidence: [], suggestedDAOProposal: 'Escalate to manual review' };
    }
  } catch (e) {
    console.error('[DisputeResolver] LLM error', e);
    return null;
  }
}

function heuristicDecision({ project, messages, proposals }) {
  // Simple rules if no LLM
  const hasDeliveryMention = messages.some(m => /deliver|submit|attached|upload/i.test(m.content || ''));
  const strongClientComplaints = messages.filter(m => m.senderId === project.clientId).filter(m => /bug|issue|missing|late|not working|refund/i.test(m.content || '')).length;
  const strongFreelancerDefense = messages.filter(m => m.senderId === project.freelancerId).filter(m => /as per spec|completed|shared proof|tests passing|on time/i.test(m.content || '')).length;

  let outcome = 'mediation_needed';
  let confidence = 0.5;
  if (strongClientComplaints >= 2 && !hasDeliveryMention) {
    outcome = 'refund_to_client'; confidence = 0.7;
  } else if (hasDeliveryMention && strongFreelancerDefense >= 1) {
    outcome = 'release_to_freelancer'; confidence = 0.7;
  } else if (strongClientComplaints >= 1 && hasDeliveryMention) {
    outcome = 'partial_split'; confidence = 0.6;
  }

  return {
    outcome,
    confidence,
    reasoning: 'Heuristic evaluation based on delivery mentions and complaint/defense signals.',
    evidence: [
      { key: 'hasDeliveryMention', value: hasDeliveryMention },
      { key: 'clientComplaintsCount', value: strongClientComplaints },
      { key: 'freelancerDefenseCount', value: strongFreelancerDefense }
    ],
    suggestedDAOProposal: outcome === 'partial_split' ? 'Split escrow 50/50 and set remediation milestones' : (
      outcome === 'refund_to_client' ? 'Refund escrow to client, allow freelancer response window' : (
        outcome === 'release_to_freelancer' ? 'Release escrow to freelancer, note evidence of delivery' : 'Escalate to manual review by DAO committee'
      )
    )
  };
}

async function analyzeDispute(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { id: true, username: true } },
      freelancer: { select: { id: true, username: true } }
    }
  });
  if (!project) throw new Error('Project not found');

  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  const proposals = await prisma.proposal.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const prompt = buildPrompt({ project, messages, proposals });
  const llm = await callLLM(prompt);
  const decision = llm || heuristicDecision({ project, messages, proposals });

  return {
    projectId,
    decision,
    meta: {
      usedLLM: Boolean(llm),
      model: llm ? (process.env.AI_MODEL || 'gpt-4o-mini') : 'heuristic',
      messagesAnalyzed: messages.length,
      proposalsAnalyzed: proposals.length
    }
  };
}

module.exports = { analyzeDispute };
