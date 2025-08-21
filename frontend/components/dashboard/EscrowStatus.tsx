'use client';

import React, { useState } from 'react';
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign,
  FileText,
  User,
  Calendar,
  ArrowRight,
  Download,
  MessageCircle
} from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits } from 'viem';
import { ESCROW_CONTRACT, TOKEN_CONTRACT, ESCROW_ADDRESS } from '@/lib/contracts';

export function EscrowStatus() {
  const [selectedEscrow, setSelectedEscrow] = useState<number | null>(null);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // On-chain form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(''); // in SKILL
  const [deadline, setDeadline] = useState(''); // ISO date
  const [skills, setSkills] = useState(''); // comma-separated
  const [projectId, setProjectId] = useState('');
  const [freelancer, setFreelancer] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  // Local tx state to emulate wagmi v2's useWriteContract result
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<Error | null>(null);

  // Helper that proxies to viem's walletClient.writeContract
  const writeContract = async (args: Parameters<NonNullable<typeof walletClient>['writeContract']>[0]) => {
    if (!walletClient) {
      setError(new Error('Wallet client not available. Connect your wallet.'));
      throw new Error('Wallet client not available');
    }
    try {
      setError(null);
      setIsPending(true);
      const hash = await walletClient.writeContract(args);
      setTxHash(hash);
      return hash;
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  // Mock escrow data
  const escrows = [
    {
      id: 1,
      projectTitle: 'E-commerce Platform Development',
      client: 'TechCorp Inc.',
      freelancer: 'John Developer',
      amount: 5000,
      status: 'active',
      milestone: 'Frontend Development',
      progress: 65,
      createdDate: '2024-01-15',
      dueDate: '2024-02-15',
      description: 'Development of responsive e-commerce frontend with React and Tailwind CSS',
      deliverables: [
        { name: 'Homepage Design', status: 'completed', submittedDate: '2024-01-20' },
        { name: 'Product Catalog', status: 'completed', submittedDate: '2024-01-25' },
        { name: 'Shopping Cart', status: 'in-progress', submittedDate: null },
        { name: 'Checkout Process', status: 'pending', submittedDate: null }
      ],
      messages: 3,
      lastActivity: '2024-01-28'
    },
    {
      id: 2,
      projectTitle: 'Mobile App UI Design',
      client: 'StartupXYZ',
      freelancer: 'Sarah Designer',
      amount: 2500,
      status: 'pending-approval',
      milestone: 'Final Design Review',
      progress: 90,
      createdDate: '2024-01-10',
      dueDate: '2024-01-30',
      description: 'Complete UI/UX design for fitness tracking mobile application',
      deliverables: [
        { name: 'Wireframes', status: 'completed', submittedDate: '2024-01-12' },
        { name: 'High-fidelity Mockups', status: 'completed', submittedDate: '2024-01-18' },
        { name: 'Prototype', status: 'completed', submittedDate: '2024-01-25' },
        { name: 'Design System', status: 'completed', submittedDate: '2024-01-27' }
      ],
      messages: 7,
      lastActivity: '2024-01-27'
    },
    {
      id: 3,
      projectTitle: 'Smart Contract Audit',
      client: 'DeFi Protocol',
      freelancer: 'Alex Blockchain',
      amount: 8000,
      status: 'completed',
      milestone: 'Security Audit Report',
      progress: 100,
      createdDate: '2024-01-05',
      dueDate: '2024-01-25',
      description: 'Comprehensive security audit of DeFi lending protocol smart contracts',
      deliverables: [
        { name: 'Initial Assessment', status: 'completed', submittedDate: '2024-01-08' },
        { name: 'Vulnerability Report', status: 'completed', submittedDate: '2024-01-15' },
        { name: 'Code Review', status: 'completed', submittedDate: '2024-01-20' },
        { name: 'Final Audit Report', status: 'completed', submittedDate: '2024-01-24' }
      ],
      messages: 12,
      lastActivity: '2024-01-25'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'pending-approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'disputed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="w-4 h-4" />;
      case 'pending-approval':
        return <AlertTriangle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'disputed':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getDeliverableStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in-progress':
        return 'text-blue-600';
      case 'pending':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* On-Chain Escrow Actions */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">On-Chain Escrow Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Project Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Build feature X" />
            <label className="text-sm text-gray-700">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Scope of work" />
            <label className="text-sm text-gray-700">Amount (SKILL)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="1000" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
            <label className="text-sm text-gray-700">Skills (comma)</label>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} className="input" placeholder="solidity, react" />
            <div className="flex gap-2 pt-2">
              <button
                disabled={isPending || !address || !ESCROW_ADDRESS || !TOKEN_CONTRACT.address}
                onClick={async () => {
                  try {
                    const amt = parseUnits(amount || '0', 18);
                    // 1) Approve escrow to pull funds
                    await writeContract({
                      abi: TOKEN_CONTRACT.abi,
                      address: TOKEN_CONTRACT.address!,
                      functionName: 'approve',
                      args: [ESCROW_ADDRESS!, amt],
                    });
                    // 2) Create project (no milestones for quick flow)
                    const deadlineTs = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
                    const skillsArr = skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
                    await writeContract({
                      abi: ESCROW_CONTRACT.abi,
                      address: ESCROW_CONTRACT.address!,
                      functionName: 'createProject',
                      args: [title, description, amt, BigInt(deadlineTs), skillsArr, []],
                    });
                  } catch (e) {
                    // swallow, error displayed below
                  }
                }}
                className="btn-primary"
              >
                Approve + Create Project
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Project ID</label>
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input" placeholder="e.g. 1" />
            <div className="flex gap-2">
              <button
                disabled={isPending || !ESCROW_CONTRACT.address}
                onClick={() => writeContract({
                  abi: ESCROW_CONTRACT.abi,
                  address: ESCROW_CONTRACT.address!,
                  functionName: 'submitWork',
                  args: [BigInt(projectId || '0')],
                })}
                className="btn-secondary"
              >
                Submit Work
              </button>
              <button
                disabled={isPending || !ESCROW_CONTRACT.address}
                onClick={() => writeContract({
                  abi: ESCROW_CONTRACT.abi,
                  address: ESCROW_CONTRACT.address!,
                  functionName: 'completeProject',
                  args: [BigInt(projectId || '0')],
                })}
                className="btn-primary"
              >
                Client Approve/Release
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Freelancer Address</label>
            <input value={freelancer} onChange={(e) => setFreelancer(e.target.value)} className="input" placeholder="0x..." />
            <div className="flex gap-2">
              <button
                disabled={isPending || !ESCROW_CONTRACT.address}
                onClick={() => writeContract({
                  abi: ESCROW_CONTRACT.abi,
                  address: ESCROW_CONTRACT.address!,
                  functionName: 'acceptFreelancer',
                  args: [BigInt(projectId || '0'), freelancer as `0x${string}`],
                })}
                className="btn-secondary"
              >
                Accept Freelancer
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Dispute Reason</label>
            <input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className="input" placeholder="Reason" />
            <button
              disabled={isPending || !ESCROW_CONTRACT.address}
              onClick={() => writeContract({
                abi: ESCROW_CONTRACT.abi,
                address: ESCROW_CONTRACT.address!,
                functionName: 'raiseDispute',
                args: [BigInt(projectId || '0'), disputeReason],
              })}
              className="btn-secondary"
            >
              Raise Dispute
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Resolve Dispute (DAO Decided)</label>
            <button
              disabled={isPending || !ESCROW_CONTRACT.address}
              onClick={() => writeContract({
                abi: ESCROW_CONTRACT.abi,
                address: ESCROW_CONTRACT.address!,
                functionName: 'resolveDispute',
                args: [BigInt(projectId || '0')],
              })}
              className="btn-primary"
            >
              Resolve Dispute
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600 pt-2">
          {isPending && <div>Transaction sending...</div>}
          {txHash && <div>Last tx hash: {String(txHash)}</div>}
          {error && <div className="text-red-600">{(error as Error).message}</div>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Escrowed</p>
              <p className="text-2xl font-bold text-gray-900">$15,500</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Escrows</p>
              <p className="text-2xl font-bold text-gray-900">1</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900">1</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">1</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Escrow List */}
      <div className="space-y-4">
        {escrows.map((escrow) => (
          <div key={escrow.id} className="bg-white border rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {escrow.projectTitle}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>Client: {escrow.client}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>Freelancer: {escrow.freelancer}</span>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-3">{escrow.description}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${getStatusColor(escrow.status)}`}>
                    {getStatusIcon(escrow.status)}
                    <span className="capitalize">{escrow.status.replace('-', ' ')}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Amount: ${escrow.amount}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Due: {new Date(escrow.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{escrow.messages} messages</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress: {escrow.milestone}</span>
                  <span className="text-sm text-gray-600">{escrow.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${escrow.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Deliverables */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-3">Deliverables</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {escrow.deliverables.map((deliverable, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          deliverable.status === 'completed' ? 'bg-green-500' :
                          deliverable.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'
                        }`}></div>
                        <span className="text-sm font-medium text-gray-900">{deliverable.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs capitalize ${getDeliverableStatusColor(deliverable.status)}`}>
                          {deliverable.status.replace('-', ' ')}
                        </span>
                        {deliverable.submittedDate && (
                          <span className="text-xs text-gray-500">
                            {new Date(deliverable.submittedDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Last activity: {new Date(escrow.lastActivity).toLocaleDateString()}
                </div>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center space-x-1">
                    <FileText className="w-4 h-4" />
                    <span>View Contract</span>
                  </button>
                  <button className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center space-x-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>Messages</span>
                  </button>
                  {escrow.status === 'pending-approval' && (
                    <button className="btn-primary px-4 py-2 flex items-center space-x-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve Release</span>
                    </button>
                  )}
                  {escrow.status === 'completed' && (
                    <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-1">
                      <Download className="w-4 h-4" />
                      <span>Download Receipt</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {escrows.length === 0 && (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Escrows Found</h3>
          <p className="text-gray-600">Your escrow transactions will appear here once you start working on projects.</p>
        </div>
      )}
    </div>
  );
}
