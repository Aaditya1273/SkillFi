'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Briefcase, 
  Users, 
  Shield, 
  Coins, 
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Award,
  BookOpen,
  Star
} from 'lucide-react';
import { JobListings } from './JobListings';
import { EscrowStatus } from './EscrowStatus';
import { TokenStaking } from './TokenStaking';
import Leaderboard from '@/components/referrals/Leaderboard';

interface JobSeekerDashboardProps {
  user: any;
}

type TabType = 'findJobs' | 'myApplications' | 'skills' | 'earnings' | 'staking';

export function JobSeekerDashboard({ user }: JobSeekerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('findJobs');

  const tabs = [
    { id: 'findJobs' as TabType, label: 'Find Jobs', icon: Search, count: 45 },
    { id: 'myApplications' as TabType, label: 'My Applications', icon: Briefcase, count: 8 },
    { id: 'skills' as TabType, label: 'Skill Development', icon: BookOpen, count: null },
    { id: 'earnings' as TabType, label: 'Earnings', icon: Coins, count: null },
    { id: 'staking' as TabType, label: 'Staking', icon: TrendingUp, count: null },
  ];

  const stats = [
    { label: 'Jobs Applied', value: '24', change: '+3', icon: Briefcase, color: 'bg-blue-500' },
    { label: 'Interviews Scheduled', value: '5', change: '+2', icon: Users, color: 'bg-green-500' },
    { label: 'Total Earned', value: '$2,850', change: '+25%', icon: Coins, color: 'bg-purple-500' },
    { label: 'Skills Verified', value: '8', change: '+1', icon: Award, color: 'bg-orange-500' },
  ];

  const recentJobs = [
    {
      id: 1,
      title: 'Senior React Developer',
      company: 'TechCorp Inc.',
      location: 'Remote',
      salary: '$80-120k',
      type: 'Full-time',
      posted: '2 days ago',
      match: '95%',
      skills: ['React', 'TypeScript', 'Node.js']
    },
    {
      id: 2,
      title: 'Blockchain Developer',
      company: 'DeFi Protocol',
      location: 'Remote',
      salary: '$100-150k',
      type: 'Contract',
      posted: '1 day ago',
      match: '88%',
      skills: ['Solidity', 'Web3', 'Smart Contracts']
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Seeker Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user?.name || user?.email}</p>
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
            {activeTab === 'findJobs' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Find Your Next Opportunity</h2>
                  <div className="flex space-x-2">
                    <button className="btn-secondary flex items-center space-x-2">
                      <Filter className="w-4 h-4" />
                      <span>Filter</span>
                    </button>
                  </div>
                </div>
                <JobListings showApplications={false} />
              </div>
            )}

            {activeTab === 'myApplications' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">My Applications</h2>
                <JobListings showApplications={true} />
              </div>
            )}

            {activeTab === 'skills' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Skill Development</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Verified Skills</h3>
                    <div className="space-y-3">
                      {['React', 'TypeScript', 'Node.js', 'Solidity', 'Web3'].map((skill) => (
                        <div key={skill} className="flex items-center justify-between">
                          <span className="font-medium">{skill}</span>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="ml-1 text-sm text-gray-600">Verified</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Recommended Courses</h3>
                    <div className="space-y-3">
                      <div className="border rounded p-3">
                        <h4 className="font-medium">Advanced Solidity</h4>
                        <p className="text-sm text-gray-600">Master smart contract development</p>
                        <button className="text-blue-600 text-sm mt-2">Start Learning</button>
                      </div>
                      <div className="border rounded p-3">
                        <h4 className="font-medium">DeFi Fundamentals</h4>
                        <p className="text-sm text-gray-600">Understand decentralized finance</p>
                        <button className="text-blue-600 text-sm mt-2">Start Learning</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'earnings' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Earnings Overview</h2>
                <EscrowStatus />
              </div>
            )}

            {activeTab === 'staking' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Token Staking</h2>
                <TokenStaking />
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="mt-8">
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
