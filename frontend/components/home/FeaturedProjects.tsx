'use client';

import { Clock, DollarSign, User } from 'lucide-react';

const projects = [
  {
    id: 1,
    title: 'Build a DeFi Dashboard',
    description: 'Looking for a React developer to create a comprehensive DeFi analytics dashboard with real-time data.',
    budget: '$2,500 - $5,000',
    duration: '2-3 weeks',
    skills: ['React', 'TypeScript', 'Web3', 'Chart.js'],
    proposals: 12,
    timePosted: '2 hours ago',
  },
  {
    id: 2,
    title: 'Smart Contract Audit',
    description: 'Need an experienced Solidity developer to audit our NFT marketplace smart contracts.',
    budget: '$1,500 - $3,000',
    duration: '1-2 weeks',
    skills: ['Solidity', 'Security', 'Audit', 'Testing'],
    proposals: 8,
    timePosted: '5 hours ago',
  },
  {
    id: 3,
    title: 'Mobile App UI/UX Design',
    description: 'Design a modern, user-friendly interface for our crypto wallet mobile application.',
    budget: '$800 - $1,500',
    duration: '1 week',
    skills: ['UI/UX', 'Figma', 'Mobile Design', 'Crypto'],
    proposals: 15,
    timePosted: '1 day ago',
  },
];

export function FeaturedProjects() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Featured Projects
          </h2>
          <p className="text-lg text-gray-600">
            Discover exciting opportunities from top clients
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="card hover:shadow-md transition-shadow cursor-pointer">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {project.title}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-3">
                  {project.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {project.budget}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {project.duration}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {project.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {project.proposals} proposals
                </div>
                <span>{project.timePosted}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button className="btn-primary">
            View All Projects
          </button>
        </div>
      </div>
    </section>
  );
}