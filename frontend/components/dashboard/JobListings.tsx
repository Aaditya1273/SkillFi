'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  DollarSign, 
  MapPin, 
  Star,
  Eye,
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface JobListingsProps {
  showApplications?: boolean;
}

export function JobListings({ showApplications = false }: JobListingsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Mock data for jobs
  const mockJobs = [
    {
      id: 1,
      title: 'Full-Stack E-commerce Platform',
      description: 'Build a modern e-commerce platform with React, Node.js, and PostgreSQL...',
      budget: 5000,
      budgetType: 'fixed',
      duration: '3-months',
      skills: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
      status: 'active',
      applicants: 12,
      postedDate: '2024-01-15',
      category: 'Web Development',
      client: {
        name: 'TechCorp Inc.',
        rating: 4.8,
        location: 'San Francisco, CA'
      }
    },
    {
      id: 2,
      title: 'Mobile App UI/UX Design',
      description: 'Design a modern mobile app interface for a fitness tracking application...',
      budget: 75,
      budgetType: 'hourly',
      duration: '1-month',
      skills: ['Figma', 'UI/UX', 'Mobile Design', 'Prototyping'],
      status: 'in-progress',
      applicants: 8,
      postedDate: '2024-01-12',
      category: 'UI/UX Design',
      client: {
        name: 'FitLife Startup',
        rating: 4.6,
        location: 'Austin, TX'
      }
    },
    {
      id: 3,
      title: 'Smart Contract Development',
      description: 'Develop and audit smart contracts for a DeFi lending protocol...',
      budget: 8000,
      budgetType: 'fixed',
      duration: '6-months',
      skills: ['Solidity', 'Web3.js', 'Hardhat', 'Security Auditing'],
      status: 'completed',
      applicants: 15,
      postedDate: '2024-01-10',
      category: 'Blockchain Development',
      client: {
        name: 'DeFi Protocol',
        rating: 4.9,
        location: 'Remote'
      }
    }
  ];

  // Mock data for applications
  const mockApplications = [
    {
      id: 1,
      jobTitle: 'React Developer for SaaS Platform',
      company: 'StartupXYZ',
      appliedDate: '2024-01-18',
      status: 'pending',
      budget: 4500,
      proposedRate: 4200,
      coverLetter: 'I have 5+ years of experience with React and would love to work on your SaaS platform...',
      timeline: '8 weeks'
    },
    {
      id: 2,
      jobTitle: 'Blockchain Integration Specialist',
      company: 'CryptoTech',
      appliedDate: '2024-01-16',
      status: 'interview',
      budget: 6000,
      proposedRate: 5800,
      coverLetter: 'With my expertise in Web3 development and smart contracts...',
      timeline: '12 weeks'
    },
    {
      id: 3,
      jobTitle: 'Full-Stack Developer',
      company: 'E-commerce Co',
      appliedDate: '2024-01-14',
      status: 'rejected',
      budget: 3500,
      proposedRate: 3200,
      coverLetter: 'I can deliver a complete e-commerce solution...',
      timeline: '6 weeks'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
      case 'interview':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'interview':
        return <MessageCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (showApplications) {
    return (
      <div className="space-y-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="interview">Interview</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Applications List */}
        <div className="space-y-4">
          {mockApplications.map((application) => (
            <div key={application.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {application.jobTitle}
                  </h3>
                  <p className="text-gray-600 mb-2">{application.company}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Applied: {new Date(application.appliedDate).toLocaleDateString()}</span>
                    <span>Timeline: {application.timeline}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${getStatusColor(application.status)}`}>
                    {getStatusIcon(application.status)}
                    <span className="capitalize">{application.status}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Budget: ${application.budget} | Proposed: ${application.proposedRate}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Cover Letter</h4>
                <p className="text-gray-600 text-sm">{application.coverLetter}</p>
              </div>

              <div className="flex justify-end space-x-3 mt-4">
                <button className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                  View Details
                </button>
                {application.status === 'pending' && (
                  <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="newest">Newest First</option>
          <option value="budget-high">Highest Budget</option>
          <option value="budget-low">Lowest Budget</option>
          <option value="applicants">Most Applicants</option>
        </select>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {mockJobs.map((job) => (
          <div key={job.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {job.title}
                </h3>
                <p className="text-gray-600 mb-3 line-clamp-2">{job.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {job.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                  {job.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  ${job.budget} {job.budgetType === 'hourly' ? '/hour' : 'fixed'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{job.duration}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{job.applicants} applicants</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium">{job.client.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{job.client.name}</p>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-gray-600">{job.client.rating}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600">{job.client.location}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                  View Details
                </button>
                {job.status === 'active' && (
                  <button className="btn-primary px-4 py-2">
                    Apply Now
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
