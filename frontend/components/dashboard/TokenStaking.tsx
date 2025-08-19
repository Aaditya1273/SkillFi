'use client';

import React, { useMemo, useState } from 'react';
import { 
  Coins, 
  TrendingUp, 
  Clock, 
  Award,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Calculator
} from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { DAO_CONTRACT, TOKEN_CONTRACT } from '@/lib/contracts';

// Optional: staking contract interaction (standard single-stake pool interface)
const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_ADDRESS as `0x${string}` | undefined;
const DEFAULT_DECIMALS = 18n;
const STAKING_ABI = [
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'stake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'getReward', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'earned', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

// Minimal ERC20 ABI pieces we need when TOKEN_CONTRACT abi is not exhaustive
const ERC20_MIN_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
];

export function TokenStaking() {
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState('flexible');
  const [showCalculator, setShowCalculator] = useState(false);
  const [proposalId, setProposalId] = useState('');
  const [voteSupport, setVoteSupport] = useState<'for' | 'against' | 'abstain'>('for');
  const [voteReason, setVoteReason] = useState('');

  const { address } = useAccount();
  const { writeContract, data: pendingHash, isPending } = useWriteContract();
  const { isLoading: waitingTx } = useWaitForTransactionReceipt({ hash: pendingHash });

  // Mock staking data
  const stakingStats = {
    totalStaked: 15000,
    totalRewards: 1250,
    availableBalance: 5000,
    stakingPower: 16250
  };

  // On-chain reads
  const tokenAddress = TOKEN_CONTRACT.address;
  const tokenAbi: any = TOKEN_CONTRACT.abi || ERC20_MIN_ABI;
  const decimalsQuery = useReadContract({
    address: tokenAddress,
    abi: tokenAbi as any,
    functionName: 'decimals',
    query: { enabled: Boolean(tokenAddress) },
  });
  const tokenDecimals = useMemo(() => {
    const d = decimalsQuery.data as number | bigint | undefined;
    if (typeof d === 'bigint') return d;
    if (typeof d === 'number') return BigInt(d);
    return DEFAULT_DECIMALS;
  }, [decimalsQuery.data]);

  const symbolQuery = useReadContract({
    address: tokenAddress,
    abi: tokenAbi as any,
    functionName: 'symbol',
    query: { enabled: Boolean(tokenAddress) },
  });
  const tokenSymbol = (symbolQuery.data as string) || 'SKILL';

  const balanceQuery = useReadContract({
    address: tokenAddress,
    abi: tokenAbi as any,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: Boolean(tokenAddress && address) },
  });
  const walletBalance = useMemo(() => {
    const v = (balanceQuery.data as bigint) || 0n;
    try { return Number(formatUnits(v, tokenDecimals)); } catch { return 0; }
  }, [balanceQuery.data, tokenDecimals]);

  const allowanceQuery = useReadContract({
    address: tokenAddress,
    abi: tokenAbi as any,
    functionName: 'allowance',
    args: [address!, STAKING_ADDRESS!],
    query: { enabled: Boolean(tokenAddress && address && STAKING_ADDRESS) },
  });
  const allowance = (allowanceQuery.data as bigint) || 0n;

  const stakingPools = [
    {
      id: 'flexible',
      name: 'Flexible Staking',
      apy: Number(process.env.NEXT_PUBLIC_STAKING_APR || 8.5),
      lockPeriod: 'None',
      minStake: 100,
      description: 'Stake and unstake anytime with competitive rewards',
      totalStaked: 50000000,
      yourStake: 5000,
      rewards: 425
    },
    {
      id: 'locked-30',
      name: '30-Day Lock',
      apy: 12.0,
      lockPeriod: '30 days',
      minStake: 500,
      description: 'Higher rewards with 30-day commitment',
      totalStaked: 25000000,
      yourStake: 10000,
      rewards: 825
    },
    {
      id: 'locked-90',
      name: '90-Day Lock',
      apy: 18.0,
      lockPeriod: '90 days',
      minStake: 1000,
      description: 'Maximum rewards with 90-day lock period',
      totalStaked: 15000000,
      yourStake: 0,
      rewards: 0
    }
  ];

  const recentTransactions = [
    {
      id: 1,
      type: 'stake',
      amount: 2500,
      pool: 'Flexible Staking',
      date: '2024-01-28',
      status: 'completed'
    },
    {
      id: 2,
      type: 'reward',
      amount: 125,
      pool: '30-Day Lock',
      date: '2024-01-27',
      status: 'completed'
    },
    {
      id: 3,
      type: 'unstake',
      amount: 1000,
      pool: 'Flexible Staking',
      date: '2024-01-25',
      status: 'completed'
    }
  ];

  const selectedPoolData = stakingPools.find(pool => pool.id === selectedPool);

  const calculateRewards = (amount: number, apy: number, days: number = 365) => {
    return (amount * (apy / 100) * (days / 365));
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) < selectedPoolData!.minStake) {
      alert(`Minimum stake amount is ${selectedPoolData!.minStake} SKILL tokens`);
      return;
    }
    if (!address) { alert('Connect wallet'); return; }
    if (!tokenAddress) { alert('Token address not configured'); return; }
    if (!STAKING_ADDRESS) { alert('Staking contract not configured'); return; }
    try {
      const amountWei = parseUnits(stakeAmount, tokenDecimals);
      if (allowance < amountWei) {
        await writeContract({
          address: tokenAddress,
          abi: tokenAbi as any,
          functionName: 'approve',
          args: [STAKING_ADDRESS, amountWei],
        });
        return; // user can click stake again after approval mined
      }
      await writeContract({ address: STAKING_ADDRESS, abi: STAKING_ABI as any, functionName: 'stake', args: [amountWei] });
      setStakeAmount('');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert('Stake failed. See console for details.');
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) > selectedPoolData!.yourStake) {
      alert('Insufficient staked amount');
      return;
    }
    if (!address) { alert('Connect wallet'); return; }
    if (!STAKING_ADDRESS) { alert('Staking contract not configured'); return; }
    try {
      const amountWei = parseUnits(unstakeAmount, tokenDecimals);
      await writeContract({ address: STAKING_ADDRESS, abi: STAKING_ABI as any, functionName: 'withdraw', args: [amountWei] });
      setUnstakeAmount('');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert('Unstake failed. See console for details.');
    }
  };

  const handleClaim = async () => {
    if (!address) { alert('Connect wallet'); return; }
    if (!STAKING_ADDRESS) { alert('Staking contract not configured'); return; }
    try {
      await writeContract({ address: STAKING_ADDRESS, abi: STAKING_ABI as any, functionName: 'getReward', args: [] });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert('Claim failed. See console for details.');
    }
  };

  const handleVote = async () => {
    if (!proposalId) { alert('Enter proposal ID'); return; }
    if (!address) { alert('Connect wallet'); return; }
    try {
      const support = voteSupport === 'for' ? 1 : voteSupport === 'against' ? 0 : 2; // Governor Bravo style mapping may vary
      await writeContract({
        address: DAO_CONTRACT.address!,
        abi: DAO_CONTRACT.abi as any,
        functionName: 'castVoteWithReason',
        args: [BigInt(proposalId), support, voteReason || ''],
      });
      setVoteReason('');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert('Vote failed. See console for details.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Staking Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Staked</p>
              <p className="text-2xl font-bold">{stakingStats.totalStaked.toLocaleString()}</p>
              <p className="text-sm text-blue-100">{tokenSymbol} Tokens</p>
            </div>
            <Coins className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Rewards</p>
              <p className="text-2xl font-bold">{stakingStats.totalRewards.toLocaleString()}</p>
              <p className="text-sm text-green-100">{tokenSymbol} Tokens</p>
            </div>
            <Award className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Available Balance</p>
              <p className="text-2xl font-bold">{walletBalance.toLocaleString()}</p>
              <p className="text-sm text-purple-100">{tokenSymbol} Tokens</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-200" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Staking Power</p>
              <p className="text-2xl font-bold">{stakingStats.stakingPower.toLocaleString()}</p>
              <p className="text-sm text-orange-100">Voting Weight</p>
            </div>
            <Award className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staking Pools */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Staking Pools</h2>
          {stakingPools.map((pool) => (
            <div 
              key={pool.id} 
              className={`bg-white border rounded-lg p-6 cursor-pointer transition-all ${
                selectedPool === pool.id ? 'border-primary-500 ring-2 ring-primary-200' : 'hover:border-gray-300'
              }`}
              onClick={() => setSelectedPool(pool.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{pool.name}</h3>
                  <p className="text-gray-600 text-sm">{pool.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{pool.apy}%</div>
                  <div className="text-sm text-gray-500">APY</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Lock Period</p>
                  <p className="font-medium">{pool.lockPeriod}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Min Stake</p>
                  <p className="font-medium">{pool.minStake} SKILL</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Your Stake</p>
                  <p className="font-medium">{pool.yourStake.toLocaleString()} SKILL</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Your Rewards</p>
                  <p className="font-medium text-green-600">{pool.rewards} SKILL</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total Pool Size</span>
                  <span className="font-medium">{(pool.totalStaked / 1000000).toFixed(1)}M SKILL</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Staking Actions */}
        <div className="space-y-6">
          {/* Stake Tokens */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stake Tokens</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Stake
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStakeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-16"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    SKILL
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                  <span>Available: {walletBalance.toLocaleString()} {tokenSymbol}</span>
                  <button 
                    onClick={() => setStakeAmount(walletBalance.toString())}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    Max
                  </button>
                </div>
              </div>

              {selectedPoolData && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Pool Details</span>
                  </div>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>APY: {selectedPoolData.apy}%</div>
                    <div>Lock Period: {selectedPoolData.lockPeriod}</div>
                    <div>Min Stake: {selectedPoolData.minStake} SKILL</div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleStake}
                disabled={!stakeAmount || isPending || waitingTx}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending || waitingTx ? 'Processing...' : 'Stake Tokens'}
              </button>
            </div>
          </div>

          {/* Unstake Tokens */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unstake Tokens</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Unstake
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={unstakeAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUnstakeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-16"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    SKILL
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                  <span>Staked: {selectedPoolData?.yourStake.toLocaleString()} SKILL</span>
                  <button 
                    onClick={() => setUnstakeAmount(selectedPoolData?.yourStake.toString() || '0')}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button 
                onClick={handleUnstake}
                disabled={!unstakeAmount || !selectedPoolData?.yourStake || isPending || waitingTx}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending || waitingTx ? 'Processing...' : 'Unstake Tokens'}
              </button>
            </div>
          </div>

          {/* Claim Rewards */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Claim Rewards</h3>
            <button
              onClick={handleClaim}
              disabled={isPending || waitingTx}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending || waitingTx ? 'Processing...' : 'Claim Rewards'}
            </button>
            {!STAKING_ADDRESS && (
              <p className="mt-2 text-xs text-amber-600">Set NEXT_PUBLIC_STAKING_ADDRESS to enable on-chain staking actions.</p>
            )}
          </div>

          {/* Rewards Calculator */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Rewards Calculator</h3>
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <Calculator className="w-5 h-5" />
              </button>
            </div>
            
            {showCalculator && (
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Rewards:</span>
                    <span className="font-medium">
                      {stakeAmount ? calculateRewards(parseFloat(stakeAmount), selectedPoolData?.apy || 0, 1).toFixed(2) : '0.00'} {tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Rewards:</span>
                    <span className="font-medium">
                      {stakeAmount ? calculateRewards(parseFloat(stakeAmount), selectedPoolData?.apy || 0, 30).toFixed(2) : '0.00'} {tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Yearly Rewards:</span>
                    <span className="font-medium text-green-600">
                      {stakeAmount ? calculateRewards(parseFloat(stakeAmount), selectedPoolData?.apy || 0, 365).toFixed(2) : '0.00'} {tokenSymbol}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Governance Voting */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Governance Voting</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proposal ID</label>
                <input
                  type="number"
                  value={proposalId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProposalId(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => setVoteSupport('for')} className={`px-3 py-1 rounded ${voteSupport==='for'?'bg-green-100 text-green-700':'bg-gray-100'}`}>For</button>
                <button onClick={() => setVoteSupport('against')} className={`px-3 py-1 rounded ${voteSupport==='against'?'bg-red-100 text-red-700':'bg-gray-100'}`}>Against</button>
                <button onClick={() => setVoteSupport('abstain')} className={`px-3 py-1 rounded ${voteSupport==='abstain'?'bg-yellow-100 text-yellow-700':'bg-gray-100'}`}>Abstain</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={voteReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVoteReason(e.target.value)}
                  placeholder="Why you voted this way"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleVote}
                disabled={!proposalId || !DAO_CONTRACT.address || isPending || waitingTx}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending || waitingTx ? 'Submitting Vote...' : 'Submit Vote'}
              </button>
              {!DAO_CONTRACT.address && (
                <p className="text-xs text-amber-600">Set NEXT_PUBLIC_DAO_ADDRESS to enable on-chain voting.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        <div className="space-y-3">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${
                  tx.type === 'stake' ? 'bg-green-100' :
                  tx.type === 'unstake' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {tx.type === 'stake' ? (
                    <ArrowUpRight className="w-4 h-4 text-green-600" />
                  ) : tx.type === 'unstake' ? (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  ) : (
                    <Award className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 capitalize">{tx.type}</p>
                  <p className="text-sm text-gray-600">{tx.pool}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">
                  {tx.type === 'unstake' ? '-' : '+'}{tx.amount.toLocaleString()} SKILL
                </p>
                <p className="text-sm text-gray-600">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
