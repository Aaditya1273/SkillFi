'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Briefcase, 
  Users, 
  Shield, 
  Coins, 
  Vote,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { JobPostingForm } from '@/components/dashboard/JobPostingForm';
import { JobListings } from '@/components/dashboard/JobListings';
import { EscrowStatus } from '@/components/dashboard/EscrowStatus';
import { TokenStaking } from '@/components/dashboard/TokenStaking';
import ReferralInvite from '@/components/referrals/ReferralInvite';
import Leaderboard from '@/components/referrals/Leaderboard';
import { GovernanceVoting } from '@/components/dashboard/GovernanceVoting';

type TabType = 'jobs' | 'applications' | 'escrow' | 'staking' | 'governance';

export default function Dashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [showJobForm, setShowJobForm] = useState(false);

  const tabs = [
    { id: 'jobs' as TabType, label: 'Jobs', icon: Briefcase, count: 12 },
    { id: 'applications' as TabType, label: 'Applications', icon: Users, count: 5 },
    { id: 'escrow' as TabType, label: 'Escrow', icon: Shield, count: 3 },
    { id: 'staking' as TabType, label: 'Staking', icon: Coins, count: null },
    { id: 'governance' as TabType, label: 'Governance', icon: Vote, count: 2 },
  ];

  const stats = [
    { label: 'Active Jobs', value: '12', change: '+2', icon: Briefcase, color: 'bg-blue-500' },
    { label: 'Total Earnings', value: '$4,250', change: '+15%', icon: Coins, color: 'bg-green-500' },
    { label: 'Completed Projects', value: '28', change: '+3', icon: CheckCircle, color: 'bg-purple-500' },
    { label: 'Success Rate', value: '94%', change: '+2%', icon: AlertCircle, color: 'bg-orange-500' },
  ];

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to access your dashboard</h1>
          <p className="text-gray-600">You need to be authenticated to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {session.user?.name || session.user?.email}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-sm text-green-600 mt-1">{stat.change}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {tab.count && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'jobs' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Job Management</h2>
                  <button
                    onClick={() => setShowJobForm(true)}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Post New Job</span>
                  </button>
                </div>
                {showJobForm ? (
                  <JobPostingForm onClose={() => setShowJobForm(false)} />
                ) : (
                  <JobListings />
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">My Applications</h2>
                <JobListings showApplications={true} />
              </div>
            )}

            {activeTab === 'escrow' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Escrow Management</h2>
                <EscrowStatus />
              </div>
            )}

            {activeTab === 'staking' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Token Staking</h2>
                <TokenStaking />
              </div>
            )}

            {activeTab === 'governance' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">DAO Governance</h2>
                <GovernanceVoting />
              </div>
            )}
          </div>
        </div>
        {/* Referral Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ReferralInvite />
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
