'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Briefcase, 
  Users, 
  Shield, 
  Coins, 
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  UserCheck,
  FileText
} from 'lucide-react';
import { JobPostingForm } from './JobPostingForm';
import { JobListings } from './JobListings';
import { EscrowStatus } from './EscrowStatus';
import { TokenStaking } from './TokenStaking';
import ReferralInvite from '@/components/referrals/ReferralInvite';
import Leaderboard from '@/components/referrals/Leaderboard';
import { GovernanceVoting } from './GovernanceVoting';

interface JobProviderDashboardProps {
  user: any;
}

type TabType = 'myJobs' | 'applications' | 'postJob' | 'earnings' | 'staking' | 'team';

export function JobProviderDashboard({ user }: JobProviderDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('myJobs');
  const [showJobForm, setShowJobForm] = useState(false);

  const tabs = [
    { id: 'myJobs' as TabType, label: 'My Jobs', icon: Briefcase, count: 12 },
    { id: 'applications' as TabType, label: 'Applications', icon: Users, count: 28 },
    { id: 'postJob' as TabType, label: 'Post Job', icon: Plus, count: null },
    { id: 'earnings' as TabType, label: 'Earnings', icon: DollarSign, count: null },
    { id: 'staking' as TabType, label: 'Staking', icon: TrendingUp, count: null },
    { id: 'team' as TabType, label: 'Team', icon: UserCheck, count: 5 },
  ];

  const stats = [
    { label: 'Active Jobs', value: '12', change: '+2', icon: Briefcase, color: 'bg-blue-500' },
    { label: 'Total Spent', value: '$15,250', change: '+35%', icon: DollarSign, color: 'bg-green-500' },
    { label: 'Hired Candidates', value: '8', change: '+3', icon: UserCheck, color: 'bg-purple-500' },
    { label: 'Success Rate', value: '92%', change: '+5%', icon: CheckCircle, color: 'bg-orange-500' },
  ];

  const recentApplications = [
    {
      id: 1,
      candidateName: 'Alice Johnson',
      jobTitle: 'Senior React Developer',
      appliedDate: '2 days ago',
      status: 'Interview Scheduled',
      skills: ['React', 'TypeScript', 'Node.js'],
      experience: '5 years',
      rating: 4.8
    },
    {
      id: 2,
      candidateName: 'Bob Smith',
      jobTitle: 'Blockchain Developer',
      appliedDate: '1 day ago',
      status: 'Under Review',
      skills: ['Solidity', 'Web3', 'Smart Contracts'],
      experience: '3 years',
      rating: 4.6
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Provider Dashboard</h1>
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
                  onClick={() => {
                    if (tab.id === 'postJob') {
                      setShowJobForm(true);
                    } else {
                      setShowJobForm(false);
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                    activeTab === tab.id && tab.id !== 'postJob'
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
            {activeTab === 'myJobs' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">My Posted Jobs</h2>
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
                  <JobListings showMyJobs={true} />
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Job Applications</h2>
                <div className="space-y-4">
                  {recentApplications.map((app) => (
                    <div key={app.id} className="bg-white border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{app.candidateName}</h3>
                          <p className="text-gray-600">{app.jobTitle}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>{app.experience} experience</span>
                            <span>•</span>
                            <span>Applied {app.appliedDate}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {app.skills.map((skill) => (
                              <span key={skill} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center mb-2">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="ml-1 text-sm">{app.rating}</span>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            app.status === 'Interview Scheduled' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 mt-4">
                        <button className="btn-primary text-sm px-3 py-1">View Profile</button>
                        <button className="btn-secondary text-sm px-3 py-1">Schedule Interview</button>
                        <button className="btn-secondary text-sm px-3 py-1">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'postJob' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Post New Job</h2>
                <JobPostingForm onClose={() => setShowJobForm(false)} />
              </div>
            )}

            {activeTab === 'earnings' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Earnings & Spending</h2>
                <EscrowStatus />
              </div>
            )}

            {activeTab === 'staking' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Token Staking</h2>
                <TokenStaking />
              </div>
            )}

            {activeTab === 'team' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Team Members</h3>
                    <div className="space-y-3">
                      {['John Doe', 'Jane Smith', 'Mike Johnson'].map((member) => (
                        <div key={member} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-300 rounded-full mr-3"></div>
                            <span>{member}</span>
                          </div>
                          <span className="text-sm text-gray-500">Admin</span>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary mt-4">Add Team Member</button>
                  </div>
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Company Profile</h3>
                    <p className="text-gray-600 mb-4">Manage your company information and branding</p>
                    <button className="btn-secondary">Edit Profile</button>
                  </div>
                </div>
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
