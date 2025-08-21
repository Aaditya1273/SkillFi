'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Vote, 
  Users, 
  Clock, 
  CheckCircle,
  XCircle,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  Calendar,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Minus
} from 'lucide-react';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { DAO_CONTRACT, TOKEN_CONTRACT } from '@/lib/contracts';
import { formatEther, getAbiItem, type Abi, type AbiEvent } from 'viem';

export function GovernanceVoting() {
  const [selectedProposal, setSelectedProposal] = useState<number | null>(null);
  const [voteChoice, setVoteChoice] = useState<'for' | 'against' | 'abstain' | null>(null);
  const [votingPower, setVotingPower] = useState('');
  const [onChainProposals, setOnChainProposals] = useState<Array<{
    id: bigint;
    proposer?: `0x${string}`;
    description?: string;
    state?: number;
    votes?: { for: bigint; against: bigint; abstain: bigint };
  }>>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // On-chain state
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: votesData, refetch: refetchVotes } = useReadContract({
    address: TOKEN_CONTRACT.address,
    abi: TOKEN_CONTRACT.abi,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!TOKEN_CONTRACT.address },
  } as any);

  const readableVotes = useMemo(() => {
    try {
      return votesData ? Number(formatEther(votesData as bigint)).toLocaleString() : '0';
    } catch {
      return '0';
    }
  }, [votesData]);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Fetch proposals from on-chain logs + read state/votes
  useEffect(() => {
    const fetchProposals = async () => {
      if (!publicClient || !DAO_CONTRACT.address) return;
      try {
        setLoadingProposals(true);
        // get ProposalCreated logs
        const proposalCreatedEvent = getAbiItem({
          abi: DAO_CONTRACT.abi as Abi,
          name: 'ProposalCreated',
        }) as AbiEvent;
        const logs = await publicClient.getLogs({
          address: DAO_CONTRACT.address as `0x${string}`,
          event: proposalCreatedEvent,
          fromBlock: 0n,
          toBlock: 'latest',
        });

        // Map logs to proposals (handle both tuple and named args from viem)
        const base = logs.map((l) => {
          const a = l.args as Record<string, unknown> | readonly unknown[] | undefined;
          let id: bigint = 0n;
          let proposer: `0x${string}` | undefined = undefined;
          let description: string | undefined = undefined;

          if (Array.isArray(a)) {
            // Many Governor ABIs emit tuple-style args: [proposalId, proposer, ... , description]
            id = (a[0] as bigint) ?? 0n;
            proposer = (a[1] as `0x${string}`) ?? undefined;
            // Description is typically the last element
            description = (a[a.length - 1] as string) ?? undefined;
          } else if (a && typeof a === 'object') {
            const r = a as Record<string, unknown>;
            id = ((r.proposalId as bigint) ?? (r.id as bigint) ?? 0n);
            proposer = (r.proposer as `0x${string}`) ?? undefined;
            description = (r.description as string) ?? undefined;
          }

          return { id, proposer, description };
        });

        // Unique by id
        const unique = Array.from(new Map(base.map(p => [p.id.toString(), p])).values());

        if (unique.length === 0) {
          setOnChainProposals([]);
          return;
        }

        // Multicall to get state and votes
        const mcCalls = unique.flatMap((p) => ([
          {
            address: DAO_CONTRACT.address as `0x${string}`,
            abi: DAO_CONTRACT.abi as any,
            functionName: 'state',
            args: [p.id],
          },
          {
            address: DAO_CONTRACT.address as `0x${string}`,
            abi: DAO_CONTRACT.abi as any,
            functionName: 'proposalVotes',
            args: [p.id],
          },
        ]));

        const results = await publicClient.multicall({ contracts: mcCalls as any });
        const enriched = unique.map((p, idx) => {
          const stateRes = results[idx * 2];
          const votesRes = results[idx * 2 + 1];
          const stateVal = (stateRes.result as any) as number;
          const [againstVotes, forVotes, abstainVotes] = (votesRes.result || [0n, 0n, 0n]) as [bigint, bigint, bigint];
          return {
            ...p,
            state: Number(stateVal),
            votes: { for: forVotes, against: againstVotes, abstain: abstainVotes },
          };
        });

        setOnChainProposals(enriched);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch proposals:', e);
      } finally {
        setLoadingProposals(false);
      }
    };

    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, DAO_CONTRACT.address]);

  // Mock governance data
  const governanceStats = {
    totalProposals: 24,
    activeProposals: 3,
    yourVotingPower: 16250,
    participationRate: 68.5
  };

  const proposals = [
    {
      id: 1,
      title: 'Increase Platform Fee to 3%',
      description: 'Proposal to increase the platform fee from 2.5% to 3% to fund additional development and security audits.',
      proposer: 'SkillFi Foundation',
      status: 'active',
      type: 'financial',
      votingPower: {
        for: 125000,
        against: 45000,
        abstain: 8000,
        total: 178000
      },
      quorum: 200000,
      startDate: '2024-01-20',
      endDate: '2024-02-03',
      description_full: 'This proposal aims to increase the platform fee from the current 2.5% to 3% to provide additional funding for platform development, security audits, and ecosystem growth. The additional revenue will be allocated as follows: 40% for development, 30% for security, 20% for marketing, and 10% for community rewards.',
      discussion: 156,
      yourVote: null
    },
    {
      id: 2,
      title: 'Implement Reputation System',
      description: 'Introduce a comprehensive reputation system for freelancers and clients based on completed projects and feedback.',
      proposer: 'Community Member',
      status: 'active',
      type: 'feature',
      votingPower: {
        for: 89000,
        against: 23000,
        abstain: 12000,
        total: 124000
      },
      quorum: 150000,
      startDate: '2024-01-22',
      endDate: '2024-02-05',
      description_full: 'This proposal introduces a multi-faceted reputation system that will help users make better decisions when hiring or applying for jobs. The system will include completion rates, quality scores, communication ratings, and timeliness metrics.',
      discussion: 89,
      yourVote: 'for'
    },
    {
      id: 3,
      title: 'Add Multi-Chain Support',
      description: 'Expand SkillFi to support Polygon and Arbitrum networks in addition to Ethereum mainnet.',
      proposer: 'Technical Committee',
      status: 'pending',
      type: 'technical',
      votingPower: {
        for: 0,
        against: 0,
        abstain: 0,
        total: 0
      },
      quorum: 180000,
      startDate: '2024-02-01',
      endDate: '2024-02-15',
      description_full: 'This proposal outlines the technical implementation for expanding SkillFi to support multiple blockchain networks, starting with Polygon and Arbitrum. This will reduce transaction costs and improve user experience.',
      discussion: 34,
      yourVote: null
    },
    {
      id: 4,
      title: 'Establish Bug Bounty Program',
      description: 'Create a bug bounty program with rewards up to $10,000 for critical security vulnerabilities.',
      proposer: 'Security Team',
      status: 'passed',
      type: 'security',
      votingPower: {
        for: 234000,
        against: 12000,
        abstain: 15000,
        total: 261000
      },
      quorum: 200000,
      startDate: '2024-01-10',
      endDate: '2024-01-24',
      description_full: 'This proposal establishes a comprehensive bug bounty program to incentivize security researchers to find and report vulnerabilities in the SkillFi platform.',
      discussion: 67,
      yourVote: 'for'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'passed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'financial':
        return 'bg-purple-100 text-purple-800';
      case 'feature':
        return 'bg-blue-100 text-blue-800';
      case 'technical':
        return 'bg-green-100 text-green-800';
      case 'security':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculatePercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return ((votes / total) * 100).toFixed(1);
  };

  const handleVote = (proposalId: number) => {
    if (!voteChoice || !votingPower) {
      alert('Please select a vote choice and enter your voting power');
      return;
    }
    
    console.log(`Voting ${voteChoice} on proposal ${proposalId} with ${votingPower} voting power`);
    // Handle voting logic here
    setVoteChoice(null);
    setVotingPower('');
  };

  return (
    <div className="space-y-6">
      {/* On-Chain Governance Quick Actions */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">On-chain Voting Power</p>
            <p className="text-2xl font-bold text-gray-900">{readableVotes}</p>
            {!address && (
              <p className="text-xs text-gray-500 mt-1">Connect your wallet to load voting power.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!address || !TOKEN_CONTRACT.address) return;
                writeContract({
                  address: TOKEN_CONTRACT.address as `0x${string}`,
                  abi: TOKEN_CONTRACT.abi as any,
                  functionName: 'delegate',
                  args: [address],
                });
              }}
              disabled={!address || !TOKEN_CONTRACT.address || isPending || isConfirming}
              className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? 'Delegating...' : 'Self-Delegate'}
            </button>
            <button
              onClick={() => refetchVotes?.()}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
        {isConfirmed && (
          <p className="text-xs text-green-600 mt-2">Delegation confirmed on-chain.</p>
        )}
      </div>
      {/* Governance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Proposals</p>
              <p className="text-2xl font-bold text-gray-900">{governanceStats.totalProposals}</p>
            </div>
            <Vote className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Proposals</p>
              <p className="text-2xl font-bold text-gray-900">{governanceStats.activeProposals}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Your Voting Power</p>
              <p className="text-2xl font-bold text-gray-900">{governanceStats.yourVotingPower.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Participation Rate</p>
              <p className="text-2xl font-bold text-gray-900">{governanceStats.participationRate}%</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {/* On-chain Proposal Voting */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-md font-semibold text-gray-900 mb-3">On-chain Proposal Voting</h3>
          <OnChainVotePanel />
        </div>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Governance Proposals</h2>
          {loadingProposals && <span className="text-sm text-gray-500">Loading on-chain…</span>}
        </div>

        {(onChainProposals.length > 0 ? onChainProposals.map((p) => ({
          id: Number(p.id),
          title: `Proposal #${Number(p.id)}`,
          description: p.description || '—',
          proposer: p.proposer || 'Unknown',
          status: p.state === 1 ? 'active' : p.state === 0 ? 'pending' : p.state === 7 ? 'passed' : 'pending',
          type: 'governance',
          votingPower: {
            for: Number(p.votes?.for ?? 0n),
            against: Number(p.votes?.against ?? 0n),
            abstain: Number(p.votes?.abstain ?? 0n),
            total: Number((p.votes?.for ?? 0n) + (p.votes?.against ?? 0n) + (p.votes?.abstain ?? 0n)),
          },
          quorum: 0,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          description_full: p.description || '—',
          discussion: 0,
          yourVote: null,
        })) : proposals).map((proposal) => (
          <div key={proposal.id} className="bg-white border rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{proposal.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                    {proposal.type && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(proposal.type)}`}>
                        {proposal.type.charAt(0).toUpperCase() + proposal.type.slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-3">{proposal.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Proposed by: {proposal.proposer}</span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(proposal.startDate).toLocaleDateString()} - {new Date(proposal.endDate).toLocaleDateString()}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{proposal.discussion} comments</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Voting Results */}
              {proposal.status !== 'pending' && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Voting Results</span>
                    <span className="text-sm text-gray-600">
                      {proposal.votingPower.total.toLocaleString()} / {proposal.quorum.toLocaleString()} votes
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {/* For votes */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 w-20">
                        <ThumbsUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">For</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${calculatePercentage(proposal.votingPower.for, proposal.votingPower.total)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">
                        {calculatePercentage(proposal.votingPower.for, proposal.votingPower.total)}%
                      </span>
                      <span className="text-sm text-gray-500 w-20 text-right">
                        {proposal.votingPower.for.toLocaleString()}
                      </span>
                    </div>

                    {/* Against votes */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 w-20">
                        <ThumbsDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-600">Against</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${calculatePercentage(proposal.votingPower.against, proposal.votingPower.total)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">
                        {calculatePercentage(proposal.votingPower.against, proposal.votingPower.total)}%
                      </span>
                      <span className="text-sm text-gray-500 w-20 text-right">
                        {proposal.votingPower.against.toLocaleString()}
                      </span>
                    </div>

                    {/* Abstain votes */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 w-20">
                        <Minus className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-600">Abstain</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gray-400 h-2 rounded-full"
                          style={{ width: `${calculatePercentage(proposal.votingPower.abstain, proposal.votingPower.total)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">
                        {calculatePercentage(proposal.votingPower.abstain, proposal.votingPower.total)}%
                      </span>
                      <span className="text-sm text-gray-500 w-20 text-right">
                        {proposal.votingPower.abstain.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Quorum indicator */}
                  <div className="mt-3 flex items-center space-x-2">
                    {proposal.votingPower.total >= proposal.quorum ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                    )}
                    <span className="text-sm text-gray-600">
                      Quorum {proposal.votingPower.total >= proposal.quorum ? 'reached' : 'not reached'} 
                      ({((proposal.votingPower.total / proposal.quorum) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Voting Actions */}
              {proposal.status === 'active' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Cast Your Vote</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vote Choice
                      </label>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setVoteChoice('for')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            voteChoice === 'for' 
                              ? 'bg-green-500 text-white' 
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          For
                        </button>
                        <button
                          onClick={() => setVoteChoice('against')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            voteChoice === 'against' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Against
                        </button>
                        <button
                          onClick={() => setVoteChoice('abstain')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            voteChoice === 'abstain' 
                              ? 'bg-gray-500 text-white' 
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Abstain
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Voting Power
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={votingPower}
                          onChange={(e) => setVotingPower(e.target.value)}
                          placeholder="0"
                          max={governanceStats.yourVotingPower}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        />
                        <button
                          onClick={() => setVotingPower(governanceStats.yourVotingPower.toString())}
                          className="px-3 py-2 text-primary-600 hover:bg-primary-50 rounded-lg text-sm"
                        >
                          Max
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Available: {governanceStats.yourVotingPower.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleVote(proposal.id)}
                      disabled={!voteChoice || !votingPower}
                      className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Vote
                    </button>
                  </div>
                </div>
              )}

              {/* Your Vote Status */}
              {proposal.yourVote && (
                <div className="bg-blue-50 rounded-lg p-3 mt-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      You voted: <span className="capitalize">{proposal.yourVote}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t mt-4">
                <button
                  onClick={() => setSelectedProposal(selectedProposal === proposal.id ? null : proposal.id)}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  {selectedProposal === proposal.id ? 'Hide Details' : 'View Details'}
                </button>
                <div className="flex space-x-3">
                  <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm">
                    <MessageSquare className="w-4 h-4" />
                    <span>Discussion</span>
                  </button>
                  <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm">
                    <ExternalLink className="w-4 h-4" />
                    <span>Full Proposal</span>
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedProposal === proposal.id && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-gray-900 mb-2">Full Description</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{proposal.description_full}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnChainVotePanel() {
  const { address } = useAccount();
  const [proposalId, setProposalId] = useState<string>('');
  const [support, setSupport] = useState<'for' | 'against' | 'abstain'>('for');
  const [reason, setReason] = useState<string>('');
  const [disputeId, setDisputeId] = useState<string>('');
  const [supportsClient, setSupportsClient] = useState<boolean>(true);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const submitVote = () => {
    if (!DAO_CONTRACT.address || !proposalId) return;
    const supportVal = support === 'for' ? 1 : support === 'against' ? 0 : 2; // GovernorCountingSimple: 0=Against,1=For,2=Abstain
    writeContract({
      address: DAO_CONTRACT.address as `0x${string}`,
      abi: DAO_CONTRACT.abi as any,
      functionName: 'castVoteWithReason',
      args: [BigInt(proposalId), supportVal, reason || ''],
    });
  };

  const voteDispute = () => {
    if (!DAO_CONTRACT.address || !disputeId) return;
    writeContract({
      address: DAO_CONTRACT.address as `0x${string}`,
      abi: DAO_CONTRACT.abi as any,
      functionName: 'voteOnDispute',
      args: [BigInt(disputeId), supportsClient],
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Proposal ID</label>
        <input
          type="number"
          value={proposalId}
          onChange={(e) => setProposalId(e.target.value)}
          placeholder="e.g. 1"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
        <div className="mt-3 flex items-center gap-2">
          <select
            value={support}
            onChange={(e) => setSupport(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="for">For</option>
            <option value="against">Against</option>
            <option value="abstain">Abstain</option>
          </select>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={submitVote}
            disabled={!address || !DAO_CONTRACT.address || !proposalId || isPending || isConfirming}
            className="btn-primary px-4 py-2 disabled:opacity-50"
          >
            {isPending || isConfirming ? 'Submitting...' : 'Cast Vote'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Dispute Voting</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={disputeId}
            onChange={(e) => setDisputeId(e.target.value)}
            placeholder="Dispute ID"
            className="px-3 py-2 border rounded-lg text-sm"
          />
          <select
            value={supportsClient ? 'client' : 'freelancer'}
            onChange={(e) => setSupportsClient(e.target.value === 'client')}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="client">Support Client</option>
            <option value="freelancer">Support Freelancer</option>
          </select>
          <button
            onClick={voteDispute}
            disabled={!address || !DAO_CONTRACT.address || !disputeId || isPending || isConfirming}
            className="btn-secondary px-4 py-2 disabled:opacity-50"
          >
            {isPending || isConfirming ? 'Submitting...' : 'Vote on Dispute'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{String(error.message || error)}</p>}
      </div>
    </div>
  );
}
